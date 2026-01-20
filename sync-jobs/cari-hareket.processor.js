const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const syncStateService = require('../services/sync-state.service');
const logger = require('../utils/logger');

class CariHareketProcessor {
    constructor() {
        this.tableName = 'CARI_HESAP_HAREKETLERI';
        this.BATCH_SIZE = 2000;
    }

    // ERP'den gelen hareket bilgilerine göre hareket tipini belirle
    mapHareketTipi(cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_iade, cha_tpoz) {
        // cha_tip: 0=Borç (Satış), 1=Alacak (Alış/Tahsilat)
        // cha_normal_iade: 0=Normal, 1=İade
        // cha_evrak_tip: 63=Satış Faturası, 0=Alış Faturası, 1=Tahsilat
        // cha_cinsi: 0=Nakit, 1=Çek, 2=Senet, 6=Fatura, 17=Havale, 19=Kredi Kartı

        // Tahsilat kontrolü - cha_evrak_tip = 1 ve cha_tip = 1
        if (cha_evrak_tip === 1 && cha_tip === 1) {
            // Tahsilat türünü cha_cinsi'ye göre belirle
            switch (cha_cinsi) {
                case 0:
                    return 'Tahsilat - Nakit';
                case 1:
                    return 'Tahsilat - Çek';
                case 2:
                    return 'Tahsilat - Senet';
                case 17:
                    return 'Tahsilat - Havale';
                case 19:
                    return 'Tahsilat - Kredi Kartı';
                default:
                    return 'Tahsilat';
            }
        }

        if (cha_evrak_tip === 63) {
            // Satış işlemleri
            if (cha_normal_iade === 1) {
                return 'Satış İade';
            } else {
                return 'Satış';
            }
        } else if (cha_evrak_tip === 0 || cha_tip === 1) {
            // Alış işlemleri
            if (cha_normal_iade === 1) {
                return 'İade';
            } else {
                return 'Alış';
            }
        }

        // Varsayılan: cha_tip'e göre
        return cha_tip === 0 ? 'Satış' : 'Alış';
    }

    // Ödeme yerini (hareket türünü) belirle
    mapHareketTuru(cha_tpoz, cha_cari_cins, hareketTipi = null) {
        // Eğer hareket_tipi "Tahsilat - X" formatındaysa, sadece X kısmını al
        if (hareketTipi && hareketTipi.includes(' - ')) {
            const parts = hareketTipi.split(' - ');
            if (parts.length === 2) {
                return parts[1].trim(); // "Tahsilat - Nakit" -> "Nakit"
            }
        }

        // cha_tpoz: 0=Açık Hesap, 1=Nakit/Kasa/Banka
        // cha_cari_cins: 0=Normal, 2=Banka, 4=Kasa

        if (cha_tpoz === 0) {
            return 'Açık Hesap';
        } else if (cha_tpoz === 1) {
            if (cha_cari_cins === 4) {
                return 'Kasadan K.';
            } else if (cha_cari_cins === 2) {
                return 'Bankadan K.';
            } else {
                return 'Kasadan K.'; // Varsayılan
            }
        }

        return 'Açık Hesap'; // Varsayılan
    }

    async syncToWeb(lastSyncTime = null) {
        try {
            const direction = 'erp_to_web';

            if (lastSyncTime === undefined || lastSyncTime === null) {
                lastSyncTime = await syncStateService.getLastSyncTime(this.tableName, direction);
            }

            // Web tarafındaki tablo boş mu kontrol et
            const countResult = await pgService.query('SELECT COUNT(*) as count FROM cari_hesap_hareketleri');
            const isWebTableEmpty = parseInt(countResult[0].count) === 0;

            if (isWebTableEmpty) {
                logger.info('Web tarafındaki cari_hesap_hareketleri tablosu boş, TAM senkronizasyon zorlanıyor.');
                lastSyncTime = null;
            }

            const isFirstSync = lastSyncTime === null;
            logger.info(`Cari Hareket senkronizasyonu başlıyor(${isFirstSync ? 'TAM' : 'İNKREMENTAL'})`);

            const changedRecords = await this.getChangedRecordsFromERP(lastSyncTime);
            logger.info(`${changedRecords.length} değişen cari hareket bulundu.Bulk işlem başlıyor...`);

            if (changedRecords.length === 0) {
                return 0;
            }

            // 1. Banka ve Kasa kodlarını al
            const bankaKodlari = await mssqlService.query('SELECT ban_kod FROM BANKALAR');
            const kasaKodlari = await mssqlService.query('SELECT kas_kod FROM KASALAR');

            const ozelKodSet = new Set([
                ...bankaKodlari.map(b => b.ban_kod),
                ...kasaKodlari.map(k => k.kas_kod)
            ]);

            logger.info(`${ozelKodSet.size} özel kod (Banka+Kasa) yüklendi.`);

            // 2. Gerekli ID'leri önbelleğe al (Cari)
            logger.info('Cari ID eşleşmeleri hazırlanıyor...');

            // Normal cari kodları (özel kod olmayanlar)
            const cariKodlari = [...new Set(changedRecords
                .filter(r => !ozelKodSet.has(r.cha_kod))
                .map(r => r.cha_kod)
                .filter(k => k))];

            // Özel kodlu işlemlerdeki müşteri isimleri
            const cariIsimleri = [...new Set(changedRecords
                .filter(r => ozelKodSet.has(r.cha_kod) && r.cha_ciro_cari_kodu)
                .map(r => r.cha_ciro_cari_kodu.trim())
                .filter(i => i))];

            let cariMapByKod = new Map();
            let cariMapByAdi = new Map();

            // Kod ile mapping
            if (cariKodlari.length > 0) {
                for (let i = 0; i < cariKodlari.length; i += 5000) {
                    const chunk = cariKodlari.slice(i, i + 5000);
                    const cariler = await pgService.query('SELECT id, cari_kodu FROM cari_hesaplar WHERE cari_kodu = ANY($1)', [chunk]);
                    cariler.forEach(c => cariMapByKod.set(c.cari_kodu, c.id));
                }
            }

            // İsim ile mapping (hem tam hem kısmi eşleşme)
            if (cariIsimleri.length > 0) {
                for (let i = 0; i < cariIsimleri.length; i += 5000) {
                    const chunk = cariIsimleri.slice(i, i + 5000);

                    // Önce tam eşleşme dene
                    const tamEslesen = await pgService.query('SELECT id, cari_adi FROM cari_hesaplar WHERE cari_adi = ANY($1)', [chunk]);
                    tamEslesen.forEach(c => cariMapByAdi.set(c.cari_adi, c.id));

                    // Tam eşleşmeyen isimleri bul
                    const eslesmeyenler = chunk.filter(isim => !cariMapByAdi.has(isim));

                    // cari_kodu ile eşleştir
                    for (const isim of eslesmeyenler) {
                        const cariKodEslesen = await pgService.query(
                            'SELECT id, cari_kodu FROM cari_hesaplar WHERE cari_kodu = $1 LIMIT 1',
                            [isim]
                        );
                        if (cariKodEslesen.length > 0) {
                            cariMapByAdi.set(isim, cariKodEslesen[0].id);
                        }
                    }
                }
            }

            logger.info(`Eşleşmeler hazır: ${cariMapByKod.size} kod, ${cariMapByAdi.size} isim.`);

            // 2. Batch İşleme
            let processedCount = 0;
            let errorCount = 0;

            for (let i = 0; i < changedRecords.length; i += this.BATCH_SIZE) {
                const batch = changedRecords.slice(i, i + this.BATCH_SIZE);
                try {
                    await this.processBatch(batch, cariMapByKod, cariMapByAdi, ozelKodSet);
                    processedCount += batch.length;
                    logger.info(`  ${processedCount}/${changedRecords.length} hareket işlendi...`);
                } catch (error) {
                    errorCount += batch.length;
                    logger.error(`Batch hatası (${i}-${i + batch.length}):`, error.message);
                }
            }

            await syncStateService.updateSyncTime(
                this.tableName,
                direction,
                processedCount,
                errorCount === 0,
                errorCount > 0 ? `${errorCount} hata oluştu` : null
            );

            logger.info(`Cari Hareket senkronizasyonu tamamlandı: ${processedCount} başarılı, ${errorCount} hata`);
            return processedCount;

        } catch (error) {
            logger.error('Cari Hareket senkronizasyon hatası:', error);
            await syncStateService.updateSyncTime(this.tableName, 'erp_to_web', 0, false, error.message);
            throw error;
        }
    }

    async getChangedRecordsFromERP(lastSyncTime) {
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (lastSyncTime) {
            whereClause += ' AND cha_lastup_date > @lastSyncTime';
            params.lastSyncTime = lastSyncTime;
        }

        const query = `
      SELECT 
        cha_RECno, cha_tarihi, cha_belge_tarih,
        cha_evrakno_sira, cha_evrakno_seri,
        cha_kod, cha_ciro_cari_kodu, cha_meblag, cha_aratoplam,
        cha_aciklama, cha_cinsi, cha_evrak_tip, cha_tip, cha_normal_Iade as cha_normal_iade,
        cha_kasa_hizkod, cha_tpoz, cha_cari_cins, cha_grupno,
        cha_ft_iskonto1, cha_ft_iskonto2, cha_ft_iskonto3,
        cha_ft_iskonto4, cha_ft_iskonto5, cha_ft_iskonto6,
        cha_vade,
        cha_lastup_date
      FROM CARI_HESAP_HAREKETLERI
      ${whereClause}
      ORDER BY cha_lastup_date
    `;

        return await mssqlService.query(query, params);
    }

    async processBatch(batch, cariMapByKod, cariMapByAdi, ozelKodSet) {
        const rows = [];

        // Debug için ilk kaydı logla
        if (batch.length > 0) {
            const first = batch[0];
            // Sadece bir kere loglamak için (veya her batch'te bir kere)
            logger.info('Sample ERP Hareket:', {
                recno: first.cha_RECno,
                kasa_hizkod: first.cha_kasa_hizkod,
                keys: Object.keys(first)
            });
        }

        for (const erpHareket of batch) {
            // Banka/Kasa işlemi kontrolü
            let cariId;
            if (ozelKodSet.has(erpHareket.cha_kod) && erpHareket.cha_ciro_cari_kodu) {
                // Banka/Kasa işlemi - isim ile eşleştir
                cariId = cariMapByAdi.get(erpHareket.cha_ciro_cari_kodu.trim());
            } else {
                // Normal işlem - kod ile eşleştir
                cariId = cariMapByKod.get(erpHareket.cha_kod);
            }

            if (!cariId) continue;

            const hareketTipi = this.mapHareketTipi(
                erpHareket.cha_evrak_tip,
                erpHareket.cha_tip,
                erpHareket.cha_cinsi,
                erpHareket.cha_normal_iade,
                erpHareket.cha_tpoz
            );

            const hareketTuru = this.mapHareketTuru(
                erpHareket.cha_tpoz,
                erpHareket.cha_cari_cins,
                hareketTipi // hareket_tipi'yi parametre olarak geç
            );

            // Banka kodu belirle (Eğer özel kod ise)
            let bankaKodu = null;
            let kasaKodu = null;

            if (ozelKodSet.has(erpHareket.cha_kod)) {
                // cha_cari_cins (2=Banka, 4=Kasa) kontrolü
                if (erpHareket.cha_cari_cins === 2) {
                    bankaKodu = erpHareket.cha_kod;
                } else if (erpHareket.cha_cari_cins === 4) {
                    kasaKodu = erpHareket.cha_kod;
                } else {
                    // cha_cari_cins güvenilir değilse cha_kod'a bakarak karar verilebilir ama şimdilik kod setine güven
                    // Varsayılan olarak banka_kodu kabul et (eski mantık)
                    bankaKodu = erpHareket.cha_kod;
                }
            }

            const belgeTipi = 'fatura';

            rows.push({
                erp_recno: erpHareket.cha_RECno,
                cari_hesap_id: cariId,
                islem_tarihi: erpHareket.cha_tarihi,
                belge_no: (erpHareket.cha_evrakno_seri || '') + (erpHareket.cha_evrakno_sira || ''),
                tutar: erpHareket.cha_meblag,
                aciklama: erpHareket.cha_aciklama,
                guncelleme_tarihi: new Date(),
                fatura_seri_no: erpHareket.cha_evrakno_seri,
                fatura_sira_no: erpHareket.cha_evrakno_sira,
                hareket_tipi: hareketTipi,
                hareket_turu: hareketTuru,
                belge_tipi: belgeTipi,
                onceki_bakiye: 0,
                sonraki_bakiye: 0,
                cha_recno: erpHareket.cha_RECno,
                cha_kasa_hizkod: erpHareket.cha_kasa_hizkod,
                banka_kodu: bankaKodu,
                kasa_kodu: kasaKodu, // Yeni alan
                cha_tpoz: erpHareket.cha_tpoz,
                cha_cari_cins: erpHareket.cha_cari_cins,
                cha_grupno: erpHareket.cha_grupno,
                vade_tarihi: (erpHareket.cha_vade && erpHareket.cha_vade !== 0) ? erpHareket.cha_vade : null,
                cek: (erpHareket.cha_cinsi === 1 || erpHareket.cha_cinsi === 3),
                senet: (erpHareket.cha_cinsi === 2 || erpHareket.cha_cinsi === 4),
                // İskonto Alanları Mapping
                iskonto1: erpHareket.cha_ft_iskonto1 || 0,
                iskonto2: erpHareket.cha_ft_iskonto2 || 0,
                iskonto3: erpHareket.cha_ft_iskonto3 || 0,
                iskonto4: erpHareket.cha_ft_iskonto4 || 0,
                iskonto5: erpHareket.cha_ft_iskonto5 || 0,
                iskonto6: erpHareket.cha_ft_iskonto6 || 0
            });
        }

        if (rows.length === 0) return;

        const columns = [
            'erp_recno', 'cari_hesap_id', 'islem_tarihi', 'belge_no', 'tutar',
            'aciklama', 'guncelleme_tarihi', 'fatura_seri_no', 'fatura_sira_no',
            'hareket_tipi', 'hareket_turu', 'belge_tipi', 'onceki_bakiye', 'sonraki_bakiye',
            'cha_recno', 'cha_kasa_hizkod', 'banka_kodu', 'kasa_kodu', 'cha_tpoz', 'cha_cari_cins', 'cha_grupno',
            'iskonto1', 'iskonto2', 'iskonto3', 'iskonto4', 'iskonto5', 'iskonto6', 'vade_tarihi',
            'cek', 'senet'
        ];

        const updateColumns = [
            'cari_hesap_id', 'islem_tarihi', 'belge_no', 'tutar',
            'aciklama', 'guncelleme_tarihi', 'fatura_seri_no', 'fatura_sira_no',
            'hareket_tipi', 'hareket_turu', 'belge_tipi', 'onceki_bakiye', 'sonraki_bakiye',
            'cha_recno', 'cha_kasa_hizkod', 'banka_kodu', 'kasa_kodu', 'cha_tpoz', 'cha_cari_cins', 'cha_grupno',
            'iskonto1', 'iskonto2', 'iskonto3', 'iskonto4', 'iskonto5', 'iskonto6', 'vade_tarihi',
            'cek', 'senet'
        ];

        const { query, values } = this.buildBulkUpsertQuery(
            'cari_hesap_hareketleri',
            columns,
            rows,
            'erp_recno',
            updateColumns
        );

        await pgService.query(query, values);
    }

    buildBulkUpsertQuery(tableName, columns, rows, conflictTarget, updateColumns) {
        const placeholders = [];
        const values = [];
        let paramIndex = 1;

        rows.forEach(row => {
            const rowPlaceholders = [];
            columns.forEach(col => {
                rowPlaceholders.push(`$${paramIndex++}`);
                values.push(row[col]);
            });
            placeholders.push(`(${rowPlaceholders.join(', ')})`);
        });

        let query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;

        if (conflictTarget) {
            query += ` ON CONFLICT (${conflictTarget}) DO UPDATE SET `;
            query += updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
        }

        return { query, values };
    }
}

module.exports = new CariHareketProcessor();

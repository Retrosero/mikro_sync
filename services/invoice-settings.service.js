const mssqlService = require('./mssql.service');
const pgService = require('./postgresql.service');
const logger = require('../utils/logger');

class InvoiceSettingsService {
    /**
     * Web'deki fatura ayarlarını ERP'deki son numaralara göre günceller
     */
    async syncInvoiceNumbers() {
        try {
            logger.info('Belge seri ve sıra numaraları senkronize ediliyor...', { context: 'invoice-sync' });

            // 1. Web'deki ayarları çek
            const settingsList = await pgService.query('SELECT * FROM user_fatura_ayarlari');

            if (!settingsList || settingsList.length === 0) {
                logger.warn('Fatura ayarı bulunamadı.', { context: 'invoice-sync' });
                return;
            }

            const marketplaces = [
                { name: 'trendyol', prefix: 'pazaryeri_trendyol_' },
                { name: 'hepsiburada', prefix: 'pazaryeri_hepsiburada_' },
                { name: 'n11', prefix: 'pazaryeri_n11_' },
                { name: 'ciceksepeti', prefix: 'pazaryeri_ciceksepeti_' },
                { name: 'pazarama', prefix: 'pazaryeri_pazarama_' },
                { name: 'idefix', prefix: 'pazaryeri_idefix_' },
                { name: 'eptt', prefix: 'pazaryeri_eptt_' }
            ];

            const generalCategories = [
                { name: 'SATIŞ/FATURA', prefix: 'fatura_', type: 'fatura' },
                { name: 'ALIŞ', prefix: 'alis_', type: 'alis' },
                { name: 'TAHSİLAT', prefix: 'tahsilat_', type: 'tahsilat' },
                { name: 'TEDİYE', prefix: 'tediye_', type: 'tediye' },
                { name: 'İADE', prefix: 'iade_', type: 'iade' },
                { name: 'SAYIM', prefix: 'sayim_', type: 'sayim' }
            ];

            for (const settings of settingsList) {
                let updateFields = [];
                let params = [];
                let paramIndex = 1;

                // A. Pazaryeri Ayarları
                for (const mp of marketplaces) {
                    const seriField = `${mp.prefix}seri_no`;
                    const siraField = `${mp.prefix}sira_no`;
                    const cariKodField = `${mp.prefix}cari_kodu`;

                    const seri = settings[seriField];
                    const cariKod = settings[cariKodField];

                    if (seri && cariKod) {
                        try {
                            const nextSira = await this._getSequence(seri, 'marketplace', cariKod);

                            if (nextSira && settings[siraField] !== nextSira) {
                                logger.info(`${mp.name.toUpperCase()} Güncelleme: ${settings[siraField]} -> ${nextSira}`, { context: 'invoice-sync' });
                                updateFields.push(`${siraField} = $${paramIndex++}`);
                                params.push(nextSira);
                            }
                        } catch (err) {
                            logger.error(`${mp.name} sıra no alınırken hata: ${err.message}`, { context: 'invoice-sync' });
                        }
                    }
                }

                // B. Genel Belge Ayarları (Satış, Alış, Tahsilat, Tediye, İade, Sayım)
                for (const cat of generalCategories) {
                    const seriField = `${cat.prefix}seri_no`;
                    const siraField = `${cat.prefix}sira_no`;

                    const seri = settings[seriField] || '';

                    try {
                        // Sayım dışındaki diğerleri için seri no dolu olmalı
                        if (cat.type !== 'sayim' && !seri) continue;

                        const nextSira = await this._getSequence(seri, cat.type);

                        if (nextSira && settings[siraField] !== nextSira) {
                            logger.info(`${cat.name} Güncelleme: ${settings[siraField]} -> ${nextSira}`, { context: 'invoice-sync' });
                            updateFields.push(`${siraField} = $${paramIndex++}`);
                            params.push(nextSira);
                        }
                    } catch (err) {
                        logger.error(`${cat.name} sıra no alınırken hata: ${err.message}`, { context: 'invoice-sync' });
                    }
                }

                if (updateFields.length > 0) {
                    params.push(settings.id);
                    const updateQuery = `UPDATE user_fatura_ayarlari SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`;
                    await pgService.query(updateQuery, params);
                    logger.info(`Fatura ayarları güncellendi (ID: ${settings.id})`, { context: 'invoice-sync' });
                }
            }

            logger.info('✅ Belge sıra numaraları senkronizasyonu tamamlandı.', { context: 'invoice-sync' });
        } catch (error) {
            logger.error('Fatura sıra no senkronizasyon hatası:', { error: error.message, context: 'invoice-sync' });
        }
    }

    /**
     * ERP'den bir seri için sıradaki evrak numarasını döndürür
     */
    async _getSequence(seri, type, cariKod = null) {
        let query = '';
        let params = { seri };

        switch (type) {
            case 'marketplace':
                query = `
                    SELECT ISNULL(MAX(cha_evrakno_sira), 0) as last_sira 
                    FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK) 
                    WHERE cha_evrakno_seri = @seri 
                    AND (cha_kod = @cariKod OR cha_ciro_cari_kodu = @cariKod OR cha_kod LIKE @cariKod + '%' OR cha_ciro_cari_kodu LIKE @cariKod + '%')
                `;
                params.cariKod = cariKod;
                break;

            case 'fatura': // Genel Satış
                query = `
                    SELECT MAX(MaxNo) as last_sira FROM (
                        SELECT ISNULL(MAX(cha_evrakno_sira), 0) as MaxNo FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK) WHERE cha_evrakno_seri = @seri AND cha_evrak_tip = 63
                        UNION ALL
                        SELECT ISNULL(MAX(sth_evrakno_sira), 0) as MaxNo FROM STOK_HAREKETLERI WITH (NOLOCK) WHERE sth_evrakno_seri = @seri AND sth_evraktip = 4
                    ) as T
                `;
                break;

            case 'alis':
                query = `
                    SELECT MAX(MaxNo) as last_sira FROM (
                        SELECT ISNULL(MAX(cha_evrakno_sira), 0) as MaxNo FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK) WHERE cha_evrakno_seri = @seri AND cha_evrak_tip = 0
                        UNION ALL
                        SELECT ISNULL(MAX(sth_evrakno_sira), 0) as MaxNo FROM STOK_HAREKETLERI WITH (NOLOCK) WHERE sth_evrakno_seri = @seri AND sth_evraktip = 3
                    ) as T
                `;
                break;

            case 'tahsilat':
                query = `SELECT ISNULL(MAX(cha_evrakno_sira), 0) as last_sira FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK) WHERE cha_evrakno_seri = @seri AND cha_evrak_tip = 1`;
                break;

            case 'tediye':
                query = `SELECT ISNULL(MAX(cha_evrakno_sira), 0) as last_sira FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK) WHERE cha_evrakno_seri = @seri AND cha_evrak_tip = 2`;
                break;

            case 'iade':
                // Hem cari hem stok hareketlerinde normal_iade flag'i 1 olanları kontrol et
                query = `
                    SELECT MAX(MaxNo) as last_sira FROM (
                        SELECT ISNULL(MAX(cha_evrakno_sira), 0) as MaxNo FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK) WHERE cha_evrakno_seri = @seri AND cha_normal_Iade = 1
                        UNION ALL
                        SELECT ISNULL(MAX(sth_evrakno_sira), 0) as MaxNo FROM STOK_HAREKETLERI WITH (NOLOCK) WHERE sth_evrakno_seri = @seri AND sth_normal_iade = 1
                    ) as T
                `;
                break;

            case 'sayim':
                query = `SELECT ISNULL(MAX(sym_evrakno), 0) as last_sira FROM SAYIM_SONUCLARI WITH (NOLOCK)`;
                break;

            default:
                return null;
        }

        const result = await mssqlService.query(query, params);
        const lastSira = result[0]?.last_sira || 0;
        return lastSira + 1;
    }
}

module.exports = new InvoiceSettingsService();


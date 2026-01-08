const mssqlService = require('./mssql.service');
const pgService = require('./postgresql.service');
const logger = require('../utils/logger');

class InvoiceSettingsService {
    /**
     * Web'deki fatura ayarlarını ERP'deki son numaralara göre günceller
     */
    async syncInvoiceNumbers() {
        try {
            logger.info('Pazaryeri fatura sıra numaraları senkronize ediliyor...', { context: 'invoice-sync' });

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

            for (const settings of settingsList) {
                let updateFields = [];
                let params = [];
                let paramIndex = 1;

                for (const mp of marketplaces) {
                    const seriField = `${mp.prefix}seri_no`;
                    const siraField = `${mp.prefix}sira_no`;
                    const cariKodField = `${mp.prefix}cari_kodu`;

                    const seri = settings[seriField];
                    const cariKod = settings[cariKodField];

                    if (seri && cariKod) {
                        try {
                            // ERP'den son sıra numarasını al
                            // Pazaryeri faturaları genelde Perakende Satış Faturası (Tip 63) olarak işleniyor.
                            // Bu yüzden tip filtresini kaldırıyoruz veya 0/63 olarak genişletiyoruz.
                            // Ayrıca cari kodlarda Türkçe karakter hassasiyeti (İ/I gibi) olabileceği için kontrolü esnetiyoruz.
                            const query = `
                                SELECT ISNULL(MAX(cha_evrakno_sira), 0) as last_sira 
                                FROM CARI_HESAP_HAREKETLERI WITH (NOLOCK) 
                                WHERE cha_evrakno_seri = @seri 
                                AND (cha_kod = @cariKod OR cha_ciro_cari_kodu = @cariKod OR cha_kod LIKE @cariKod + '%' OR cha_ciro_cari_kodu LIKE @cariKod + '%')
                            `;
                            logger.info(`ERP Sorgulanıyor: Seri=${seri}, Cari=${cariKod}`, { context: 'invoice-sync' });
                            const result = await mssqlService.query(query, { seri: seri, cariKod: cariKod });
                            const lastSira = result[0]?.last_sira || 0;
                            const nextSira = lastSira + 1;

                            logger.info(`${mp.name.toUpperCase()} Sonuç: ERP Son Sıra=${lastSira}, Web Beklenen=${nextSira}, Mevcut Web=${settings[siraField]}`, { context: 'invoice-sync' });

                            if (settings[siraField] !== nextSira) {
                                logger.info(`GÜNCELLEME GEREKLİ: ${settings[siraField]} -> ${nextSira}`, { context: 'invoice-sync' });
                                updateFields.push(`${siraField} = $${paramIndex++}`);
                                params.push(nextSira);
                            } else {
                                logger.info(`GÜNCELLEME GEREKMİYOR: Değerler zaten güncel.`, { context: 'invoice-sync' });
                            }
                        } catch (err) {
                            logger.error(`${mp.name} sıra no alınırken hata: ${err.message}`, { context: 'invoice-sync' });
                        }
                    } else {
                        logger.warn(`${mp.name.toUpperCase()} için seri veya cari kod eksik: Seri=${seri}, Cari=${cariKod}`, { context: 'invoice-sync' });
                    }
                }

                if (updateFields.length > 0) {
                    params.push(settings.id);
                    const updateQuery = `UPDATE user_fatura_ayarlari SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`;
                    await pgService.query(updateQuery, params);
                    logger.info(`Fatura ayarları güncellendi (ID: ${settings.id})`, { context: 'invoice-sync' });
                }
            }

            logger.info('✅ Fatura sıra numaraları senkronizasyonu tamamlandı.', { context: 'invoice-sync' });
        } catch (error) {
            logger.error('Fatura sıra no senkronizasyon hatası:', { error: error.message, context: 'invoice-sync' });
        }
    }
}

module.exports = new InvoiceSettingsService();

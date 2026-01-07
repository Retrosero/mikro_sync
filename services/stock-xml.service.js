const mssqlService = require('./mssql.service');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class StockXMLService {
    constructor() {
        this.localFilePath = path.join(__dirname, '..', process.env.FTP_XML_NAME || 'sadece-stoklar.xml');
        this.lastRun = 0;
    }

    /**
     * MS SQL'den stok verilerini çekip XML dosyası oluşturur
     */
    async generateXML() {
        try {
            logger.info('Stok XML verileri MS SQL\'den çekiliyor...', { context: 'stock-xml' });

            const query = `
        SELECT
            S.sto_kod AS Product_code,
            S.sto_isim AS Name,
            S.sto_marka_kodu AS Brand,
            S.sto_kisa_ismi AS alt_baslik,
            S.sto_yer_kod AS raf_numarasi,
            S.sto_sektor_kodu AS alt_baslik2,
            S.sto_ambalaj_kodu AS mensei,
            S.sto_altgrup_kod AS grup_kod,
            S.sto_anagrup_kod AS ana_grup_kod,
            B.bar_kodu AS barcode,
            SHM.sth_eldeki_miktar AS stock,
            SF1.sfiyat_fiyati AS Price,
            SF2.sfiyat_fiyati AS Price2,
            SF3.sfiyat_fiyati AS Pricebayi
        FROM
            STOKLAR S WITH (NOLOCK)
        LEFT JOIN
            BARKOD_TANIMLARI B WITH (NOLOCK) ON S.sto_kod = B.bar_stokkodu
        LEFT JOIN
            STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW SHM WITH (NOLOCK) ON S.sto_kod = SHM.sth_stok_kod
        LEFT JOIN
            STOK_SATIS_FIYAT_LISTELERI SF1 WITH (NOLOCK) ON S.sto_kod = SF1.sfiyat_stokkod AND SF1.sfiyat_listesirano = 1
        LEFT JOIN
            STOK_SATIS_FIYAT_LISTELERI SF2 WITH (NOLOCK) ON S.sto_kod = SF2.sfiyat_stokkod AND SF2.sfiyat_listesirano = 2
        LEFT JOIN
            STOK_SATIS_FIYAT_LISTELERI SF3 WITH (NOLOCK) ON S.sto_kod = SF3.sfiyat_stokkod AND SF3.sfiyat_listesirano = 3
      `;

            const rows = await mssqlService.query(query);
            logger.info(`${rows.length} adet stok verisi alındı. XML oluşturuluyor...`, { context: 'stock-xml' });

            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<Products>\n';

            for (const row of rows) {
                xmlContent += '  <Product>\n';
                xmlContent += `    <Product_code>${this.escapeXml(row.Product_code)}</Product_code>\n`;
                xmlContent += `    <Name>${this.escapeXml(row.Name)}</Name>\n`;
                xmlContent += `    <Brand>${this.escapeXml(row.Brand)}</Brand>\n`;
                xmlContent += `    <alt_baslik>${this.escapeXml(row.alt_baslik)}</alt_baslik>\n`;
                xmlContent += `    <raf_numarasi>${this.escapeXml(row.raf_numarasi)}</raf_numarasi>\n`;
                xmlContent += `    <alt_baslik2>${this.escapeXml(row.alt_baslik2)}</alt_baslik2>\n`;
                xmlContent += `    <mensei>${this.escapeXml(row.mensei)}</mensei>\n`;
                xmlContent += `    <grup_kod>${this.escapeXml(row.grup_kod)}</grup_kod>\n`;
                xmlContent += `    <ana_grup_kod>${this.escapeXml(row.ana_grup_kod)}</ana_grup_kod>\n`;
                xmlContent += `    <barcode>${this.escapeXml(row.barcode)}</barcode>\n`;
                xmlContent += `    <stock>${row.stock || 0}</stock>\n`;
                xmlContent += `    <Price>${row.Price || 0}</Price>\n`;
                xmlContent += `    <Price2>${row.Price2 || 0}</Price2>\n`;
                xmlContent += `    <Pricebayi>${row.Pricebayi || 0}</Pricebayi>\n`;
                xmlContent += '  </Product>\n';
            }

            xmlContent += '</Products>';

            fs.writeFileSync(this.localFilePath, xmlContent, 'utf8');
            logger.info(`XML dosyası yerel olarak oluşturuldu: ${this.localFilePath}`, { context: 'stock-xml' });
            return true;
        } catch (error) {
            logger.error('Stok XML oluşturma hatası:', { context: 'stock-xml', error: error.message });
            return false;
        }
    }

    /**
     * XML özel karakterlerini kaçırır
     */
    escapeXml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe).replace(/[<>&"']/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '"': return '&quot;';
                case "'": return '&apos;';
            }
        });
    }

    /**
     * scp.exe kullanarak dosyayı SSH üzerinden yükler
     */
    async uploadToSSH() {
        try {
            const host = process.env.SSH_HOST;
            const user = process.env.SSH_USER || 'root';
            const port = process.env.SSH_PORT || '22';
            const keyPath = process.env.SSH_PRIVATE_KEY_PATH;
            const remotePath = process.env.SSH_REMOTE_PATH || '/var/www/html/';
            const fileName = process.env.FTP_XML_NAME || 'sadece-stoklar.xml';

            if (!host || !keyPath) {
                logger.warn('SSH bilgileri (host/key path) eksik, yükleme yapılamadı.', { context: 'stock-xml' });
                return false;
            }

            // Private key dosyasının varlığını kontrol et
            if (!fs.existsSync(keyPath)) {
                logger.error(`SSH private key dosyası bulunamadı: ${keyPath}`, { context: 'stock-xml' });
                return false;
            }

            logger.info(`SSH (SCP) ile yükleniyor: ${host}...`, { context: 'stock-xml' });

            // scp -i key -P port localfile user@host:remotepath
            // Windows'ta scp.exe StrictHostKeyChecking'i sormasın diye: -o StrictHostKeyChecking=no
            const scpCommand = `scp.exe -i "${keyPath}" -P ${port} -o StrictHostKeyChecking=no "${this.localFilePath}" ${user}@${host}:${remotePath}${fileName}`;

            logger.info(`Çalıştırılacak komut: ${scpCommand}`, { context: 'stock-xml' });

            execSync(scpCommand, { stdio: 'inherit' });

            logger.info('✅ Stok XML dosyası başarıyla SSH üzerinden sunucuya yüklendi.', { context: 'stock-xml' });
            return true;
        } catch (error) {
            logger.error('SSH yükleme hatası:', { context: 'stock-xml', error: error.message });
            return false;
        }
    }

    /**
     * Belirli aralıklarla XML oluşturup yüklemeyi sağlar
     */
    async checkAndRun() {
        const intervalMin = parseInt(process.env.STOCK_XML_SYNC_INTERVAL_MIN || '60');
        const now = Date.now();

        if (now - this.lastRun > intervalMin * 60 * 1000) {
            logger.info('Stok XML zamanlanmış görev başlıyor...', { context: 'stock-xml' });
            const generated = await this.generateXML();
            if (generated) {
                // SSH yüklemesini dene
                const uploaded = await this.uploadToSSH();
                if (uploaded) {
                    this.lastRun = now;
                }
            }
        }
    }
}

module.exports = new StockXMLService();

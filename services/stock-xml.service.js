const mssqlService = require('./mssql.service');
const pgService = require('./postgresql.service');
const logger = require('../utils/logger');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

class StockXMLService {
    constructor() {
        this.localFilePath = path.join(__dirname, '..', process.env.FTP_XML_NAME || 'sadece-stoklar.xml');
        this.lastRun = 0;
        this.isRunning = false;
    }

    cleanEnvValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value)
            .trim()
            .replace(/^['"]|['"]$/g, '')
            .replace(/\s+#.*$/, '')
            .trim();
    }

    resolvePrivateKeyPath(rawPath) {
        const cleanedPath = this.cleanEnvValue(rawPath);
        if (!cleanedPath) {
            return null;
        }

        const normalizedPath = path.normalize(cleanedPath);
        if (!fs.existsSync(normalizedPath)) {
            return null;
        }

        const stat = fs.statSync(normalizedPath);
        if (stat.isFile()) {
            return normalizedPath;
        }

        if (!stat.isDirectory()) {
            return null;
        }

        const preferredNames = ['id_ed25519', 'id_rsa', 'id_ecdsa', 'id_dsa', 'ssh'];
        for (const name of preferredNames) {
            const candidate = path.join(normalizedPath, name);
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return candidate;
            }
        }

        const files = fs.readdirSync(normalizedPath)
            .map(fileName => path.join(normalizedPath, fileName))
            .filter(filePath => fs.existsSync(filePath) && fs.statSync(filePath).isFile());

        if (files.length === 0) {
            return null;
        }

        const rank = (name) => {
            if (name === 'id_ed25519') return 0;
            if (name === 'id_rsa') return 1;
            if (name === 'id_ecdsa') return 2;
            if (name === 'id_dsa') return 3;
            if (name === 'ssh') return 4;
            return 5;
        };

        files.sort((a, b) => rank(path.basename(a).toLowerCase()) - rank(path.basename(b).toLowerCase()) || a.localeCompare(b));
        return files[0];
    }

    runCommand(command, description) {
        try {
            execSync(command, { stdio: 'pipe' });
        } catch (error) {
            const stderr = error.stderr ? error.stderr.toString('utf8').trim() : '';
            const stdout = error.stdout ? error.stdout.toString('utf8').trim() : '';
            const details = stderr || stdout || error.message;
            throw new Error(`${description} başarısız: ${details}`);
        }
    }

    prepareRestrictedKeyFile(sourceKeyPath) {
        const tempDir = path.join(os.tmpdir(), 'mikro-sync-ssh');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempKeyPath = path.join(tempDir, `stock-xml-${process.pid}-${Date.now()}`);
        fs.copyFileSync(sourceKeyPath, tempKeyPath);

        const aclCommand = `cmd.exe /c icacls "${tempKeyPath}" /inheritance:r /grant:r "%USERNAME%:F"`;

        try {
            execSync(aclCommand, { stdio: 'pipe' });
        } catch (error) {
            try {
                fs.unlinkSync(tempKeyPath);
            } catch (cleanupError) {
                logger.warn(`Geçici anahtar dosyası temizlenemedi: ${cleanupError.message}`, { context: 'stock-xml' });
            }

            const stderr = error.stderr ? error.stderr.toString('utf8').trim() : '';
            const stdout = error.stdout ? error.stdout.toString('utf8').trim() : '';
            const details = stderr || stdout || error.message;
            throw new Error(`Geçici anahtar izinleri ayarlanamadı: ${details}`);
        }

        return tempKeyPath;
    }

    async runNow() {
        if (this.isRunning) {
            return {
                success: false,
                message: 'Stok XML işlemi zaten çalışıyor.'
            };
        }

        this.isRunning = true;

        try {
            const generated = await this.generateXML();
            if (!generated) {
                return {
                    success: false,
                    message: 'XML oluşturulamadı.'
                };
            }

            const uploaded = await this.uploadToSSH();
            if (!uploaded) {
                return {
                    success: false,
                    message: 'XML oluşturuldu ama sunucuya yüklenemedi.'
                };
            }

            return {
                success: true,
                message: 'Stok XML oluşturuldu ve sunucuya yüklendi.'
            };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * MS SQL'den stok verilerini çekip XML dosyası oluşturur
     */
    async generateXML() {
        let runtimeKeyPath = null;
        try {
            logger.info('Stok XML verileri MS SQL\'den çekiliyor...', { context: 'stock-xml' });

            const query = `
        SELECT
            S.sto_RECno AS product_id,
            LTRIM(RTRIM(S.sto_kod)) AS Product_code,
            S.sto_isim AS Name,
            S.sto_marka_kodu AS Brand,
            S.sto_kisa_ismi AS alt_baslik,
            S.sto_yer_kod AS raf_numarasi,
            S.sto_sektor_kodu AS alt_baslik2,
            S.sto_ambalaj_kodu AS mensei,
            S.sto_altgrup_kod AS grup_kod,
            S.sto_anagrup_kod AS ana_grup_kod,
            B.bar_kodu AS barcode,
            ISNULL(SHM.sth_eldeki_miktar, 0) AS stock,
            ISNULL(SF1.sfiyat_fiyati, 0) AS Price,
            ISNULL(SF2.sfiyat_fiyati, 0) AS Price2,
            ISNULL(SF3.sfiyat_fiyati, 0) AS Pricebayi
        FROM
            STOKLAR S WITH (NOLOCK)
        OUTER APPLY (
            SELECT TOP 1 bar_kodu 
            FROM BARKOD_TANIMLARI B WITH (NOLOCK) 
            WHERE S.sto_kod = B.bar_stokkodu 
            ORDER BY B.bar_RECno
        ) B
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
            logger.info(`${rows.length} adet stok verisi alındı. Fotoğraflar eşleştiriliyor...`, { context: 'stock-xml' });

            // Entegra Fotoğraflarını Çek
            const photoMap = await this.getEntegraPhotoMap();

            // PostgreSQL Senkronizasyonu (Fotoğraflarla birlikte)
            await this.syncToPostgres(rows, photoMap);

            const nowStr = new Date().toLocaleString('tr-TR');
            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xmlContent += `<!-- Generated At: ${nowStr} -->\n`;
            xmlContent += '<Products>\n';
            xmlContent += '  <Metadata>\n';
            xmlContent += `    <GeneratedAt>${nowStr}</GeneratedAt>\n`;
            xmlContent += `    <ProductCount>${rows.length}</ProductCount>\n`;
            xmlContent += '  </Metadata>\n';

            for (const row of rows) {
                const photos = photoMap.get(row.Product_code) || [];

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

                // Fotoğrafları XML'e ekle
                if (photos.length > 0) {
                    xmlContent += '    <Images>\n';
                    photos.forEach((img, idx) => {
                        xmlContent += `      <Image${idx + 1}>${this.escapeXml(img)}</Image${idx + 1}>\n`;
                    });
                    xmlContent += '    </Images>\n';
                }

                xmlContent += '  </Product>\n';
            }

            xmlContent += '</Products>';

            fs.writeFileSync(this.localFilePath, xmlContent, 'utf8');
            logger.info(`XML dosyası yerel olarak oluşturuldu: ${this.localFilePath}`, { context: 'stock-xml' });
            return true;
        } catch (error) {
            logger.error('Stok XML oluşturma hatası:', { context: 'stock-xml', error: error.message });
            return false;
        } finally {
            if (runtimeKeyPath && fs.existsSync(runtimeKeyPath)) {
                try {
                    fs.unlinkSync(runtimeKeyPath);
                } catch (cleanupError) {
                    logger.warn(`Geçici anahtar dosyası silinemedi: ${cleanupError.message}`, { context: 'stock-xml' });
                }
            }
        }
    }

    /**
     * Entegra tablolarından stok koduna göre fotoğrafları getiren bir map döner
     */
    async getEntegraPhotoMap() {
        try {
            const photoMap = new Map();
            const query = `
                SELECT ep."productCode", pic.url, pic.path
                FROM entegra_product ep
                JOIN entegra_pictures pic ON ep.id = pic.product_id
                ORDER BY ep."productCode", pic.sort_order
            `;
            const rows = await pgService.query(query);

            rows.forEach(row => {
                let img = row.url || row.path;
                if (!img) return;

                // Başlangıçtaki "/" karakterini kaldır
                if (img.startsWith('/')) {
                    img = img.substring(1);
                }

                if (!photoMap.has(row.productCode)) {
                    photoMap.set(row.productCode, []);
                }
                photoMap.get(row.productCode).push(img);
            });

            return photoMap;
        } catch (error) {
            logger.warn('Entegra fotoğrafları çekilemedi:', error.message);
            return new Map();
        }
    }

    /**
     * Verileri PostgreSQL 'xmlurunler' tablosuna senkronize eder
     */
    async syncToPostgres(rows, photoMap) {
        if (!rows || rows.length === 0) return;

        try {
            logger.info(`PostgreSQL (xmlurunler) senkronizasyonu başlıyor... (${rows.length} kayıt)`, { context: 'stock-xml' });

            // Gerekli kolonların varlığını kontrol et ve eksikse oluştur
            await pgService.query(`
                ALTER TABLE xmlurunler ADD COLUMN IF NOT EXISTS raf_numarasi text;
                ALTER TABLE xmlurunler ADD COLUMN IF NOT EXISTS mensei text;
                ALTER TABLE xmlurunler ADD COLUMN IF NOT EXISTS grup_kod text;
                ALTER TABLE xmlurunler ADD COLUMN IF NOT EXISTS ana_grup_kod text;
                ALTER TABLE xmlurunler ADD COLUMN IF NOT EXISTS "Price2" numeric DEFAULT 0;
                ALTER TABLE xmlurunler ADD COLUMN IF NOT EXISTS "Pricebayi" numeric DEFAULT 0;
            `);

            // Batch size for PostgreSQL upsert
            const BATCH_SIZE = 100; // Fotoğraflarla birlikte batch boyutu küçültüldü
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);

                const columnNames = [
                    'product_id', 'product_code', 'name', 'brand', 'alt_baslik', 'alt_baslik2',
                    'barcode', 'stock', 'price', 'raf_numarasi', 'mensei', 'grup_kod',
                    'ana_grup_kod', '"Price2"', '"Pricebayi"', 'images',
                    'images1', 'images2', 'images3', 'images4', 'images5',
                    'images6', 'images7', 'images8', 'images9', 'updated_at'
                ];

                const values = [];
                const placeholders = [];
                let paramIdx = 1;

                batch.forEach(row => {
                    const photos = photoMap.get(row.Product_code);
                    if (i === 0 && values.length === 0) {
                        logger.debug(`Örnek veri senkronizasyonu - Kod: ${row.Product_code}, Fotos: ${JSON.stringify(photos)}`);
                    }

                    const rowValues = [
                        row.product_id,
                        row.Product_code,
                        row.Name,
                        row.Brand,
                        row.alt_baslik,
                        row.alt_baslik2,
                        row.barcode,
                        row.stock,
                        row.Price,
                        row.raf_numarasi,
                        row.mensei,
                        row.grup_kod,
                        row.ana_grup_kod,
                        row.Price2,
                        row.Pricebayi,
                        photos || [], // ARRAY
                        (photos && photos[0]) || null,
                        (photos && photos[1]) || null,
                        (photos && photos[2]) || null,
                        (photos && photos[3]) || null,
                        (photos && photos[4]) || null,
                        (photos && photos[5]) || null,
                        (photos && photos[6]) || null,
                        (photos && photos[7]) || null,
                        (photos && photos[8]) || null,
                        new Date()
                    ];

                    const p = rowValues.map((v, idx) => {
                        const pid = paramIdx++;
                        return idx === 15 ? `$${pid}::text[]` : `$${pid}`;
                    });
                    placeholders.push(`(${p.join(',')})`);
                    values.push(...rowValues);
                });

                const upsertQuery = `
                    INSERT INTO xmlurunler (${columnNames.join(',')})
                    VALUES ${placeholders.join(',')}
                    ON CONFLICT (product_code) DO UPDATE SET
                        product_id = EXCLUDED.product_id,
                        name = EXCLUDED.name,
                        brand = EXCLUDED.brand,
                        alt_baslik = EXCLUDED.alt_baslik,
                        alt_baslik2 = EXCLUDED.alt_baslik2,
                        barcode = EXCLUDED.barcode,
                        stock = EXCLUDED.stock,
                        price = EXCLUDED.price,
                        raf_numarasi = EXCLUDED.raf_numarasi,
                        mensei = EXCLUDED.mensei,
                        grup_kod = EXCLUDED.grup_kod,
                        ana_grup_kod = EXCLUDED.ana_grup_kod,
                        "Price2" = EXCLUDED."Price2",
                        "Pricebayi" = EXCLUDED."Pricebayi",
                        images = EXCLUDED.images,
                        images1 = EXCLUDED.images1,
                        images2 = EXCLUDED.images2,
                        images3 = EXCLUDED.images3,
                        images4 = EXCLUDED.images4,
                        images5 = EXCLUDED.images5,
                        images6 = EXCLUDED.images6,
                        images7 = EXCLUDED.images7,
                        images8 = EXCLUDED.images8,
                        images9 = EXCLUDED.images9,
                        updated_at = EXCLUDED.updated_at
                `;

                await pgService.query(upsertQuery, values);
            }

            logger.info('PostgreSQL (xmlurunler) senkronizasyonu tamamlandı.', { context: 'stock-xml' });
        } catch (error) {
            logger.error('PostgreSQL (xmlurunler) senkronizasyon hatası:', { context: 'stock-xml', error: error.message });
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
        let runtimeKeyPath = null;
        try {
            const host = this.cleanEnvValue(process.env.SSH_HOST);
            const user = this.cleanEnvValue(process.env.SSH_USER) || 'root';
            const port = this.cleanEnvValue(process.env.SSH_PORT) || '22';
            const keyPath = this.resolvePrivateKeyPath(process.env.SSH_PRIVATE_KEY_PATH);
            const remotePath = this.cleanEnvValue(process.env.SSH_REMOTE_PATH) || '/var/www/html/';
            const fileName = this.cleanEnvValue(process.env.FTP_XML_NAME) || 'sadece-stoklar.xml';

            if (!host || !keyPath) {
                logger.warn('SSH bilgileri (host/key path) eksik, yükleme yapılamadı.', { context: 'stock-xml' });
                return false;
            }

            // Private key dosyasının varlığını kontrol et
            if (!keyPath) {
                logger.error(`SSH private key dosyası bulunamadı: ${keyPath}`, { context: 'stock-xml' });
                return false;
            }

            logger.info(`SSH (SCP) ile yükleniyor: ${host}...`, { context: 'stock-xml' });

            // 1. TEMİZLİK: Önce host üzerindeki eski dosyayı sil
            const normalizedRemotePath = remotePath.endsWith('/') ? remotePath : `${remotePath}/`;
            runtimeKeyPath = this.prepareRestrictedKeyFile(keyPath);
            const sshBase = `ssh.exe -i "${runtimeKeyPath}" -o IdentitiesOnly=yes -o BatchMode=yes -p ${port} -o StrictHostKeyChecking=no ${user}@${host}`;
            const scpBase = `scp.exe -i "${runtimeKeyPath}" -o IdentitiesOnly=yes -o BatchMode=yes -P ${port} -o StrictHostKeyChecking=no`;

            const cleanHostCommand = `${sshBase} "rm -f ${normalizedRemotePath}${fileName}"`;
            logger.info('Eski dosya host üzerinden temizleniyor...', { context: 'stock-xml' });
            try { this.runCommand(cleanHostCommand, 'Eski dosya temizleme'); } catch (e) {
                logger.warn(`Eski dosya temizlenemedi, yükleme devam ediyor: ${e.message}`, { context: 'stock-xml' });
            }

            // 2. DİZİN HAZIRLA: Hedef dizini oluştur
            const mkdirCommand = `${sshBase} "mkdir -p ${normalizedRemotePath}"`;
            try { this.runCommand(mkdirCommand, 'Hedef dizin oluşturma'); } catch (e) {
                logger.warn(`Hedef dizin oluşturulamadı, yükleme denenecek: ${e.message}`, { context: 'stock-xml' });
            }

            // 3. YÜKLE: SCP ile host üzerine yükle
            const scpCommand = `${scpBase} "${this.localFilePath}" ${user}@${host}:${normalizedRemotePath}${fileName}`;
            logger.info(`Dosya yükleniyor: ${scpCommand}`, { context: 'stock-xml' });
            try {
                this.runCommand(scpCommand, 'SCP yükleme');
            } catch (error) {
                const lower = error.message.toLowerCase();
                if (lower.includes('permission denied') || lower.includes('passphrase') || lower.includes('authentication') || lower.includes('publickey')) {
                    throw new Error('SSH kimlik doğrulaması başarısız. Private key sunucuda yetkili değil, anahtar passphrase istiyor ya da yanlış key kullanılıyor.');
                }
                throw error;
            }

            // 4. DAĞIT: xargs kullanarak tüm aktif Docker konteynırları içine kopyalamayı dene
            const distributeCommands = [
                `docker ps -q | xargs -I {} docker cp ${normalizedRemotePath}${fileName} {}:/usr/share/nginx/html/${fileName} 2>/dev/null || true`,
                `docker ps -q | xargs -I {} docker cp ${normalizedRemotePath}${fileName} {}:/app/public/${fileName} 2>/dev/null || true`,
                `docker ps -q | xargs -I {} docker cp ${normalizedRemotePath}${fileName} {}:/app/${fileName} 2>/dev/null || true`
            ];

            logger.info('Docker konteynırları güncelleniyor (xargs)...', { context: 'stock-xml' });
            for (const cmd of distributeCommands) {
                const fullCmd = `${sshBase} "${cmd}"`;
                try {
                    this.runCommand(fullCmd, 'Docker dağıtımı');
                } catch (e) { }
            }
            logger.info('✅ Docker konteynırları güncellendi.', { context: 'stock-xml' });

            logger.info('✅ Stok XML dosyası başarıyla SSH üzerinden sunucuya yüklendi.', { context: 'stock-xml' });
            return true;
        } catch (error) {
            logger.error('SSH yükleme hatası:', { context: 'stock-xml', error: error.message });
            return false;
        } finally {
            if (runtimeKeyPath && fs.existsSync(runtimeKeyPath)) {
                try {
                    fs.unlinkSync(runtimeKeyPath);
                } catch (cleanupError) {
                    logger.warn(`GeÃ§ici anahtar dosyasÄ± silinemedi: ${cleanupError.message}`, { context: 'stock-xml' });
                }
            }
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

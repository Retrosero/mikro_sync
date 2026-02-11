const pgService = require('./postgresql.service');
const mssqlService = require('./mssql.service');
const logger = require('../utils/logger');

class ProductNameNormalizerService {
    /**
     * Türkçe karakter desteği ile ürün ismini normalize eder
     * Her kelimenin ilk harfi büyük, diğerleri küçük olacak şekilde
     */
    normalizeProductName(name) {
        if (!name || typeof name !== 'string') {
            return name;
        }

        // --- Gelişmiş Ön İşleme (Advanced Pre-processing) ---
        let processedName = name;

        // 1. Sayı ve ekleri ayır (Örn: 5li -> 5 Li, 3lü -> 3 Lü)
        processedName = processedName.replace(/(\d+)(li|lü|lu|lı)/gi, '$1 $2');

        // 2. Özel Kelime Düzeltmeleri ve Değişimleri (Regex ile tüm isme uygula)
        const corrections = [
            { pattern: /Ç\/B/gi, replacement: 'Çek Bırak' },
            { pattern: /U\/K/gi, replacement: 'Uzaktan Kumandalı' },
            { pattern: /Belıssa/gi, replacement: 'Bellissa' },
            { pattern: /Çarp\/Dön/gi, replacement: 'Çarp Dön' },
            { pattern: /Çarpmalı\/Dönen/gi, replacement: 'Çarpmalı Dönen' },
            { pattern: /aksesuarlıfıgür/gi, replacement: 'Aksesuarlı Figür' },
            { pattern: /aksesuarlıfigür/gi, replacement: 'Aksesuarlı Figür' },
            { pattern: /aksesuarlifigur/gi, replacement: 'Aksesuarlı Figür' },
            { pattern: /aksesuarlı/gi, replacement: 'Aksesuarlı ' },
            { pattern: /çekbırak/gi, replacement: 'Çek Bırak' },
            { pattern: /cekbirak/gi, replacement: 'Çek Bırak' },
            { pattern: /denız altı/gi, replacement: 'Denizaltı' },
            { pattern: /deniz altı/gi, replacement: 'Denizaltı' },
            { pattern: /sılıkon/gi, replacement: 'Silikon' },
            { pattern: /silikon/gi, replacement: 'Silikon' },
            { pattern: /gozlugu/gi, replacement: 'Gözlüğü' },
            { pattern: /gozluk/gi, replacement: 'Gözlük' },
            { pattern: /çantalı/gi, replacement: 'Çantalı' },
            { pattern: /yetıskın/gi, replacement: 'Yetişkin' },
            { pattern: /golgelikli/gi, replacement: 'Gölgelikli' },
            { pattern: /balına/gi, replacement: 'Balina' },
            { pattern: /desenlı/gi, replacement: 'Desenli' },
            { pattern: /fılelı/gi, replacement: 'Fileli' },
            { pattern: /golgelıklı/gi, replacement: 'Gölgelikli' },
            { pattern: /sımıt/gi, replacement: 'Simit' },
            { pattern: /lastık/gi, replacement: 'Lastik' },
            { pattern: /sekıllı/gi, replacement: 'Şekilli' },
            { pattern: /sevımlı/gi, replacement: 'Sevimli' },
            { pattern: /dunyası/gi, replacement: 'Dünyası' },
            { pattern: /tımsah/gi, replacement: 'Timsah' },
            { pattern: /ıplı/gi, replacement: 'İpli' },
            { pattern: /renklı/gi, replacement: 'Renkli' },
            { pattern: /gozlu/gi, replacement: 'Gözlü' },
            { pattern: /çıçek/gi, replacement: 'Çiçek' },
            { pattern: /tropıcal/gi, replacement: 'Tropikal' },
            { pattern: /surpriz/gi, replacement: 'Sürpriz' },
            { pattern: /sürtmeli/gi, replacement: 'Sürtmeli' },
            { pattern: /tutmalı/gi, replacement: 'Tutmalı' },
            { pattern: /bınıcı/gi, replacement: 'Binici' },
            { pattern: /buyuk/gi, replacement: 'Büyük' },
            { pattern: /kucuk/gi, replacement: 'Küçük' },
            { pattern: /donusen/gi, replacement: 'Dönüşen' },
            { pattern: /tufeklı/gi, replacement: 'Tüfekli' },
            { pattern: /kısılık/gi, replacement: 'Kişilik' },
            { pattern: /arac/gi, replacement: 'Araç' },
            { pattern: /fıskıyelı/gi, replacement: 'Fıskiyeli' },
            { pattern: /bowlınglı/gi, replacement: 'Bowlingli' },
            { pattern: /bolmelı/gi, replacement: 'Bölmeli' },
            { pattern: /dıkdörtgen/gi, replacement: 'Dikdörtgen' },
            { pattern: /krıstal/gi, replacement: 'Kristal' },
            { pattern: /kumas/gi, replacement: 'Kumaş' },
            { pattern: /fıgur/gi, replacement: 'Figür' },
            { pattern: /gercekcı/gi, replacement: 'Gerçekçi' },
            { pattern: /kopekbalığı/gi, replacement: 'Köpekbalığı' },
            { pattern: /kopek/gi, replacement: 'Köpek' },
            { pattern: /flamıngo/gi, replacement: 'Flamingo' },
            { pattern: /isıklı/gi, replacement: 'Işıklı' },
            { pattern: /isık/gi, replacement: 'Işık' },
            { pattern: /seslı/gi, replacement: 'Sesli' },
            { pattern: /mınık/gi, replacement: 'Minik' },
            { pattern: /evım/gi, replacement: 'Evim' },
            { pattern: /donusebılen/gi, replacement: 'Dönüşebilen' },
            { pattern: /denız/gi, replacement: 'Deniz' },
            { pattern: /koruklu/gi, replacement: 'Körüklü' },
            { pattern: /kurek/gi, replacement: 'Kürek' },
            { pattern: /cıft/gi, replacement: 'Çift' },
            { pattern: /kostumlu/gi, replacement: 'Kostümlü' },
            { pattern: /supriz/gi, replacement: 'Sürpriz' },
            { pattern: /yastıgı/gi, replacement: 'Yastığı' },
            { pattern: /vınç/gi, replacement: 'Vinç' },
            { pattern: /tekerleklı/gi, replacement: 'Tekerlekli' }
        ];

        corrections.forEach(k => {
            processedName = processedName.replace(k.pattern, k.replacement);
        });

        // Gereksiz çift boşlukları temizle
        processedName = processedName.replace(/\s+/g, ' ').trim();

        // Özel durumlar - büyük kalması gereken/istenen kelimeler
        const specialCases = {
            'CM': 'CM',
            'MM': 'MM',
            'KG': 'KG',
            'GR': 'GR',
            'ML': 'ML',
            'LT': 'LT',
            'M2': 'M2',
            'M3': 'M3',
            'AST': 'Ast',
            'ADET': 'Adet',
            'SET': 'Set',
            'PCS': 'Pcs',
            'LED': 'LED',
            'USB': 'USB',
            'RC': 'RC',
            'VR': 'VR',
            '3D': '3D',
            '4D': '4D',
            '5D': '5D'
        };

        // Türkçe karakter mapping
        const turkishToLower = (char) => {
            const map = { 'İ': 'i', 'I': 'ı', 'Ş': 'ş', 'Ğ': 'ğ', 'Ü': 'ü', 'Ö': 'ö', 'Ç': 'ç' };
            return map[char] || char.toLowerCase();
        };

        const turkishToUpper = (char) => {
            const map = { 'i': 'İ', 'ı': 'I', 'ş': 'Ş', 'ğ': 'Ğ', 'ü': 'Ü', 'ö': 'Ö', 'ç': 'Ç' };
            return map[char] || char.toUpperCase();
        };

        const words = processedName.split(/(\s+|-|\/)/);

        const normalizedWords = words.map(word => {
            if (/^\s+$/.test(word) || word === '-' || word === '/') return word;

            const upperWord = word.toUpperCase();
            if (specialCases[upperWord]) return specialCases[upperWord];
            if (/^\d+$/.test(word)) return word;
            if (word.length === 0) return word;

            // Zaten düzeltme listesinde olduğu için Title Case uygularken karakter bozmamaya dikkat et
            // Eğer kelime corrections içinde geçmişse (yani büyük harfle başlıyorsa vb.) title case'i koru
            const firstChar = turkishToUpper(word[0]);
            const restChars = word.slice(1).split('').map(c => turkishToLower(c)).join('');
            return firstChar + restChars;
        });

        return normalizedWords.join('');
    }

    /**
     * Tüm ürünleri getirir ve normalize edilmiş isimlerini hesaplar
     */
    async getAllProductsForReview(limit = 50000, offset = 0) {
        try {
            const query = `
        SELECT 
          stok_kodu,
          stok_adi,
          kategori_id,
          marka_id
        FROM stoklar
        WHERE stok_adi IS NOT NULL
        ORDER BY stok_kodu
        LIMIT $1 OFFSET $2
      `;

            const products = await pgService.query(query, [limit, offset]);

            // Her ürün için normalize edilmiş ismi hesapla
            const productsWithNormalized = products.map(product => {
                const normalizedName = this.normalizeProductName(product.stok_adi);
                const hasChange = product.stok_adi !== normalizedName;

                return {
                    stok_kodu: product.stok_kodu,
                    current_name: product.stok_adi,
                    normalized_name: normalizedName,
                    has_change: hasChange,
                    kategori_id: product.kategori_id,
                    marka_id: product.marka_id
                };
            });

            return productsWithNormalized;
        } catch (error) {
            logger.error('Ürünleri getirme hatası:', error);
            throw error;
        }
    }

    /**
     * İstatistikleri getirir
     */
    async getStats() {
        try {
            const totalQuery = 'SELECT COUNT(*) as total FROM stoklar WHERE stok_adi IS NOT NULL';
            const totalResult = await pgService.query(totalQuery);
            const total = parseInt(totalResult[0].total);

            // Değişecek ürün sayısını hesaplamak için tüm ürünleri kontrol et
            const allProducts = await this.getAllProductsForReview(50000, 0);
            const needsUpdate = allProducts.filter(p => p.has_change).length;

            return {
                total_products: total,
                needs_update: needsUpdate,
                up_to_date: total - needsUpdate
            };
        } catch (error) {
            logger.error('İstatistik hatası:', error);
            throw error;
        }
    }

    /**
     * Onaylanan ürün isimlerini toplu olarak günceller
     * @param {Array} updates - [{stok_kodu, new_name}, ...]
     */
    async updateProductNames(updates) {
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            throw new Error('Güncellenecek ürün bulunamadı');
        }

        const results = {
            success: [],
            failed: [],
            total: updates.length
        };

        logger.info(`${updates.length} ürün ismi güncelleniyor...`);

        // Batch işleme - 100'er 100'er güncelle
        const batchSize = 100;
        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);

            for (const update of batch) {
                try {
                    await this.updateSingleProduct(update.stok_kodu, update.new_name);
                    results.success.push(update.stok_kodu);
                    logger.info(`✓ ${update.stok_kodu}: "${update.new_name}"`);
                } catch (error) {
                    logger.error(`✗ ${update.stok_kodu} güncellenemedi:`, error.message);
                    results.failed.push({
                        stok_kodu: update.stok_kodu,
                        error: error.message
                    });
                }
            }

            // Her batch sonrası kısa bekleme
            if (i + batchSize < updates.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        logger.info(`Güncelleme tamamlandı: ${results.success.length} başarılı, ${results.failed.length} başarısız`);
        return results;
    }

    /**
     * Tek bir ürünü hem PostgreSQL hem MSSQL'de günceller
     */
    async updateSingleProduct(stokKodu, newName) {
        try {
            // 1. PostgreSQL (Web) Güncelleme (Limit yok veya çok yüksek)
            const pgQuery = `
                UPDATE stoklar 
                SET stok_adi = $1, 
                    guncelleme_tarihi = NOW() 
                WHERE stok_kodu = $2
            `;
            await pgService.query(pgQuery, [newName, stokKodu]);

            // 2. MSSQL (Mikro ERP) Güncelleme
            // Mikro'da sto_isim genellikle 50 karakterdir, fazlası hata verir.
            const truncatedName = newName.substring(0, 50);

            const mssqlQuery = `
                UPDATE STOKLAR 
                SET sto_isim = @name,
                    sto_lastup_date = GETDATE(),
                    sto_lastup_user = 1
                WHERE sto_kod = @code
            `;
            await mssqlService.query(mssqlQuery, {
                name: truncatedName,
                code: stokKodu
            });

            return true;
        } catch (error) {
            logger.error(`Ürün güncelleme hatası (${stokKodu}):`, error);
            throw error;
        }
    }

    /**
     * Arama ve filtreleme ile ürünleri getirir
     */
    async searchProducts(searchTerm, limit = 50000, offset = 0) {
        try {
            const query = `
        SELECT 
          stok_kodu,
          stok_adi,
          kategori_id,
          marka_id
        FROM stoklar
        WHERE stok_adi IS NOT NULL
          AND (
            LOWER(stok_kodu) LIKE LOWER($1)
            OR LOWER(stok_adi) LIKE LOWER($1)
          )
        ORDER BY stok_kodu
        LIMIT $2 OFFSET $3
      `;

            const searchPattern = `%${searchTerm}%`;
            const products = await pgService.query(query, [searchPattern, limit, offset]);

            // Her ürün için normalize edilmiş ismi hesapla
            const productsWithNormalized = products.map(product => {
                const normalizedName = this.normalizeProductName(product.stok_adi);
                const hasChange = product.stok_adi !== normalizedName;

                return {
                    stok_kodu: product.stok_kodu,
                    current_name: product.stok_adi,
                    normalized_name: normalizedName,
                    has_change: hasChange,
                    kategori_id: product.kategori_id,
                    marka_id: product.marka_id
                };
            });

            return productsWithNormalized;
        } catch (error) {
            logger.error('Ürün arama hatası:', error);
            throw error;
        }
    }
}

module.exports = new ProductNameNormalizerService();

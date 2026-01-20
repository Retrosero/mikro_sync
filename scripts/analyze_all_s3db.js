const Database = require('better-sqlite3');
const path = require('path');

// Farklı veritabanı dosyalarını dene
const dbPaths = [
    'C:\\Users\\Gürbüz Oyuncak\\Desktop\\db.s3db',
    'C:\\Users\\Gürbüz Oyuncak\\Desktop\\sqlite-tools-win-x64-3510100\\yeni.s3db',
    'C:\\Users\\Gürbüz Oyuncak\\Desktop\\sqlite-tools-win-x64-3510100\\eski.s3db'
];

function analyzeDatabase(dbPath) {
    console.log('\n' + '='.repeat(80));
    console.log(`📁 VERİTABANI: ${dbPath}`);
    console.log('='.repeat(80));

    try {
        const db = new Database(dbPath);

        console.log('\n📋 TABLOLAR:');
        console.log('-'.repeat(60));
        const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
        if (tables.length === 0) {
            console.log('   Tablo bulunamadı.');
            db.close();
            return;
        }
        tables.forEach(t => console.log(' • ' + t.name));

        console.log('\n⚡ TRIGGER\'LAR:');
        console.log('-'.repeat(60));
        const triggers = db.prepare(`SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'`).all();
        if (triggers.length === 0) {
            console.log('   Trigger bulunamadı.');
        } else {
            triggers.forEach(t => {
                console.log(`\n📌 ${t.name} (Tablo: ${t.tbl_name})`);
                console.log(t.sql);
            });
        }

        console.log('\n👁️ VIEW\'LAR:');
        console.log('-'.repeat(60));
        const views = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type='view'`).all();
        if (views.length === 0) {
            console.log('   View bulunamadı.');
        } else {
            views.forEach(v => {
                console.log(`\n📌 ${v.name}`);
                console.log(v.sql);
            });
        }

        // Tüm tabloların yapısını göster
        console.log('\n\n📊 TÜM TABLOLARIN YAPISI VE ÖRNEKLERİ:');
        console.log('='.repeat(60));
        tables.forEach(t => {
            console.log(`\n📁 ${t.name}`);
            console.log('-'.repeat(40));
            const columns = db.prepare(`PRAGMA table_info("${t.name}")`).all();
            columns.forEach(c => {
                console.log(`   • ${c.name} (${c.type})${c.pk ? ' [PK]' : ''}`);
            });
            try {
                const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
                console.log(`   📊 Kayıt sayısı: ${count.cnt}`);

                // İlk 5 kaydı göster
                if (count.cnt > 0 && count.cnt <= 100) {
                    const rows = db.prepare(`SELECT * FROM "${t.name}" LIMIT 20`).all();
                    console.log('   📝 Örnek veriler:');
                    rows.forEach((r, i) => {
                        console.log(`   [${i + 1}]`, JSON.stringify(r, null, 0).substring(0, 500));
                    });
                } else if (count.cnt > 100) {
                    const rows = db.prepare(`SELECT * FROM "${t.name}" LIMIT 5`).all();
                    console.log('   📝 İlk 5 kayıt:');
                    rows.forEach((r, i) => {
                        console.log(`   [${i + 1}]`, JSON.stringify(r, null, 0).substring(0, 500));
                    });
                }
            } catch (e) {
                console.log('   ⚠️ Veri okunamadı:', e.message);
            }
        });

        db.close();
    } catch (e) {
        console.log('❌ Veritabanı açılamadı:', e.message);
    }
}

// Tüm veritabanlarını analiz et
dbPaths.forEach(analyzeDatabase);

console.log('\n✅ Analiz tamamlandı.');

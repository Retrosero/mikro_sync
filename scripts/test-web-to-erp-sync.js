const satisProcessor = require('../sync-jobs/satis.processor');
const tahsilatProcessor = require('../sync-jobs/tahsilat.processor');
const pgService = require('../services/postgresql.service');
const lookupTables = require('../mappings/lookup-tables');
const logger = require('../utils/logger');

// Mock PG Service
pgService.query = async (query, params) => {
    console.log('Mock PG Query:', query, params);
    if (query.includes('satis_kalemleri')) {
        return [
            {
                stok_id: 'mock-stok-uuid',
                miktar: 1,
                toplam_tutar: 100,
                kdv_tutari: 18,
                kdv_orani: 18,
                indirim_tutari: 0
            }
        ];
    }
    return [];
};

// Mock Lookup Tables
lookupTables.getCariKod = async () => 'SERHAN'; // Trace'deki örnek cari
lookupTables.getStokKod = async () => 'H'; // Trace'deki örnek stok
lookupTables.getKasaKod = async () => '001';
lookupTables.getBankaKod = async () => '01';
lookupTables.getKdvPointer = async () => 0;

async function runTest() {
    try {
        console.log('Starting Web -> ERP Sync Test...');

        // 1. Test Satis Sync (Veresiye)
        const mockSatis = {
            id: 'test-satis-001',
            satis_tarihi: new Date(),
            fatura_sira_no: null, // Otomatik almalı
            fatura_seri_no: 'WT',
            cari_hesap_id: 'mock-cari-uuid',
            toplam_tutar: 100,
            ara_toplam: 100,
            odeme_sekli: 'veresiye',
            notlar: 'Test Satis Sync'
        };

        console.log('Testing Satis Sync (Veresiye)...');
        await satisProcessor.syncToERP(mockSatis);
        console.log('Satis Sync Completed.');

        // 2. Test Tahsilat Sync (Nakit)
        const mockTahsilatNakit = {
            id: 'test-tahsilat-nakit-001',
            tahsilat_tarihi: new Date(),
            tahsilat_sira_no: null,
            tahsilat_seri_no: 'WT',
            cari_hesap_id: 'mock-cari-uuid',
            tutar: 50,
            tahsilat_tipi: 'nakit',
            kasa_id: 'mock-kasa-uuid',
            aciklama: 'Test Tahsilat Nakit'
        };

        console.log('Testing Tahsilat Sync (Nakit)...');
        await tahsilatProcessor.syncToERP(mockTahsilatNakit);
        console.log('Tahsilat Nakit Sync Completed.');

        // 3. Test Tahsilat Sync (Çek)
        const mockTahsilatCek = {
            id: 'test-tahsilat-cek-001',
            tahsilat_tarihi: new Date(),
            tahsilat_sira_no: null,
            tahsilat_seri_no: 'WT',
            cari_hesap_id: 'mock-cari-uuid',
            tutar: 1500,
            tahsilat_tipi: 'cek',
            cek_no: 'CEK12345',
            banka_adi: 'TEST BANK',
            sube_adi: 'TEST SUBE',
            hesap_no: '123456',
            cek_vade_tarihi: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 gün vade
            aciklama: 'Test Tahsilat Cek'
        };

        console.log('Testing Tahsilat Sync (Çek)...');
        await tahsilatProcessor.syncToERP(mockTahsilatCek);
        console.log('Tahsilat Çek Sync Completed.');

    } catch (error) {
        console.error('Test Error:', error);
    } finally {
        // Close connections if needed (though mssql service manages pool)
        process.exit(0);
    }
}

runTest();

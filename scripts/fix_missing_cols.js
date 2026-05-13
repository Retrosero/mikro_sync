
const pg = require('../services/postgresql.service');

async function fix() {
    const sqls = [
        'ALTER TABLE "entegra_order" ADD COLUMN "efatura_cancel_sync" INTEGER;',
        'ALTER TABLE "entegra_product_quantity" ADD COLUMN "min_quantity" INTEGER;',
        'ALTER TABLE "entegra_product" ADD COLUMN "cozmopol_category" TEXT;',
        'ALTER TABLE "entegra_product" ADD COLUMN "send_cozmopol" INTEGER;',
        'ALTER TABLE "entegra_product" ADD COLUMN "amazonRetail_sku" TEXT;',
        'ALTER TABLE "entegra_brand" ADD COLUMN "eptt_brand" TEXT;',
        'ALTER TABLE "entegra_brand" ADD COLUMN "cozmopol_id" TEXT;',
        'ALTER TABLE "entegra_brand" ADD COLUMN "ai_brand_mapped" INTEGER;',
        'ALTER TABLE "entegra_category" ADD COLUMN "cozmopol_category" TEXT;',
        'ALTER TABLE "entegra_category" ADD COLUMN "productDescriptionCozmopol" TEXT;'
    ];

    for (const sql of sqls) {
        try {
            await pg.query(sql);
            console.log('Fixed:', sql);
        } catch (e) {
            console.error('Error fixing:', sql, e.message);
        }
    }
    process.exit(0);
}

fix();

const pgService = require('./services/postgresql.service');

async function main() {
    try {
        // Fetch the pending picture record from entegra_pictures
        const pic = await pgService.query("SELECT * FROM entegra_pictures WHERE sync = '0' ORDER BY id DESC LIMIT 1");

        if (pic.length === 0) {
            console.log("No pending pictures found with sync='0'. Checking recently updated instead...");
            const recentPic = await pgService.query("SELECT * FROM entegra_pictures ORDER BY id DESC LIMIT 1");
            if (recentPic.length > 0) {
                pic.push(recentPic[0]);
            } else {
                console.log("No pictures found in entegra_pictures.");
                return;
            }
        }

        const picture = pic[0];
        console.log("Targeting picture:", picture);

        // Manually insert into sync_queue
        const res = await pgService.query(
            `INSERT INTO sync_queue (
                entity_type, entity_id, operation, status, retry_count, record_data, created_at
            ) VALUES (
                'entegra_pictures', $1, 'UPDATE', 'pending', 0, $2, NOW()
            ) RETURNING id`,
            [picture.id, picture]
        );

        console.log("Successfully inserted manual sync_queue item:", res[0].id);

    } catch (e) {
        console.error("Error triggering sync:", e);
    } finally {
        await pgService.disconnect();
    }
}

main();

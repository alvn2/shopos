require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');
    const hashedPassword = await bcrypt.hash('admin', 10);

    const shops = ['STEPMOTORS', 'CARWORLD'];

    for (const shop_id of shops) {
        await prisma.settings.upsert({
            where: { shop_id },
            update: {},
            create: {
                shop_id,
                aed_rate: 36.5,
                conversion_percent: 13.0,
                default_min_stock: 5,
            }
        });

        await prisma.user.upsert({
            where: { shop_id_username: { shop_id, username: 'admin' } },
            update: { password_hash: hashedPassword },
            create: {
                shop_id,
                username: 'admin',
                password_hash: hashedPassword,
                role: 'admin',
                full_name: 'Shop Admin'
            }
        });
        console.log(`Created admin for ${shop_id}`);
    }

    console.log('Database seeded successfully.');
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

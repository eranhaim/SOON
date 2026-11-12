/** Dev script: `npm run db:seed`. Production seeds in migrate.ts on every deploy. */
import { db, pool } from './index';
import { seedCategories } from './seed-categories';

seedCategories(db)
  .then((n) => console.log(`Seeded ${n} categories.`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

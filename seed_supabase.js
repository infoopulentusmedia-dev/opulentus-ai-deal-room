const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Alhamdullilah1!@db.frqkprocfjxuggahrwxs.supabase.co:5432/postgres';

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to Supabase Postgres!');

        const sql = fs.readFileSync(path.join(__dirname, 'supabase_schema.sql'), 'utf8');
        console.log('Executing schema...');
        await client.query(sql);
        console.log('Schema executed successfully!');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.end();
    }
}

run();

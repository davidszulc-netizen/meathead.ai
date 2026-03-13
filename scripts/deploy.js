#!/usr/bin/env node
// Deploys meathead.ai/site/ to GoDaddy cPanel hosting via FTP.
// Requires a .env file in the meathead.ai directory with:
//   FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR

const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const siteDir = path.join(root, 'site');

// Load .env
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env file not found at', envPath);
    console.error('Copy .env.example to .env and fill in your FTP credentials.');
    process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const { FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR = '/public_html' } = process.env;
if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
    console.error('ERROR: FTP_HOST, FTP_USER, and FTP_PASS must be set in .env');
    process.exit(1);
}

async function deploy() {
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
        console.log(`Connecting to ${FTP_HOST}...`);
        await client.access({
            host: FTP_HOST,
            port: 21,
            user: FTP_USER,
            password: FTP_PASS,
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        });

        console.log(`Uploading site/ -> ${FTP_REMOTE_DIR}`);
        await client.ensureDir(FTP_REMOTE_DIR);
        await client.uploadFromDir(siteDir, FTP_REMOTE_DIR);
        console.log('\nDeploy complete!');
    } catch (err) {
        // Try plain FTP if FTPS fails
        if (err.code === 'ECONNRESET' || String(err).includes('secure')) {
            console.log('FTPS failed, retrying with plain FTP...');
            await client.access({
                host: FTP_HOST,
                user: FTP_USER,
                password: FTP_PASS,
                secure: false
            });
            await client.ensureDir(FTP_REMOTE_DIR);
            await client.uploadFromDir(siteDir, FTP_REMOTE_DIR);
            console.log('\nDeploy complete!');
        } else {
            throw err;
        }
    } finally {
        client.close();
    }
}

deploy().catch(err => {
    console.error('Deploy failed:', err.message);
    process.exit(1);
});

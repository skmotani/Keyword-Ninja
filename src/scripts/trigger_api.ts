
// Uses global fetch (Node 18+)

async function main() {
    console.log('--- Triggering Q013 API ---');
    try {
        const response = await fetch('http://localhost:3000/api/reports/dashboard/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientCode: '01',
                queryId: 'Q013'
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('Error:', e);
    }
}

main();

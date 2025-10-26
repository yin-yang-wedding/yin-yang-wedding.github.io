// Wedding Data Management Script
// This script helps you manage wedding content in DynamoDB without using the AWS Console

const AWS = require('aws-sdk');

// Configure AWS (make sure you have AWS CLI configured or environment variables set)
const dynamodb = new AWS.DynamoDB.DocumentClient({
    region: 'us-east-1' // Change to your preferred region
});

const TABLE_NAME = 'WeddingData';

// Sample wedding content structure
const sampleWeddingContent = {
    id: 'main',
    content: `
        <div class="content-section">
            <h2>Ceremony Details</h2>
            <p><strong>Date:</strong> June 15, 2024</p>
            <p><strong>Time:</strong> 4:00 PM</p>
            <p><strong>Location:</strong> Sunlight Gardens</p>
            <p><strong>Address:</strong> 123 Main Street, Your City, State 12345</p>
            <p><strong>Dress Code:</strong> Semi-formal</p>
        </div>
        
        <div class="content-section">
            <h2>Reception</h2>
            <p><strong>Time:</strong> 6:00 PM - 11:00 PM</p>
            <p><strong>Location:</strong> Same Venue - Garden Pavilion</p>
            <p><strong>Dinner:</strong> Plated dinner will be served at 7:00 PM</p>
            <p><strong>Dancing:</strong> DJ and dancing from 8:00 PM onwards</p>
        </div>
        
        <div class="content-section">
            <h2>RSVP Information</h2>
            <p><strong>RSVP Deadline:</strong> May 15, 2024</p>
            <p><strong>Contact:</strong> jessica.will.wedding@gmail.com</p>
            <p><strong>Phone:</strong> (555) 123-4567</p>
            <p>Please let us know about any dietary restrictions or special accommodations needed.</p>
        </div>
        
        <div class="content-section">
            <h2>Accommodations</h2>
            <p><strong>Recommended Hotels:</strong></p>
            <p>• Garden Inn & Suites - (555) 234-5678</p>
            <p>• Downtown Hotel - (555) 345-6789</p>
            <p>Special wedding rates available - mention "Smith-Johnson Wedding"</p>
        </div>
        
        <div class="content-section">
            <h2>Transportation</h2>
            <p>Complimentary shuttle service will be provided from recommended hotels to the venue.</p>
            <p>Pickup times: 3:30 PM and return service at 11:30 PM</p>
        </div>
        
        <div class="content-section">
            <h2>Gift Registry</h2>
            <p>Your presence is the greatest gift! If you wish to give a gift, we are registered at:</p>
            <p>• Target</p>
            <p>• Williams Sonoma</p>
            <p>• Honeymoon fund: [Link to honeymoon registry]</p>
        </div>
    `,
    lastUpdated: new Date().toISOString()
};

// Function to create/update wedding content
async function updateWeddingContent(content = sampleWeddingContent) {
    try {
        const params = {
            TableName: TABLE_NAME,
            Item: {
                ...content,
                lastUpdated: new Date().toISOString()
            }
        };
        
        await dynamodb.put(params).promise();
        console.log('✅ Wedding content updated successfully!');
        console.log('Last updated:', params.Item.lastUpdated);
    } catch (error) {
        console.error('❌ Error updating wedding content:', error);
    }
}

// Function to retrieve current wedding content
async function getWeddingContent() {
    try {
        const params = {
            TableName: TABLE_NAME,
            Key: { id: 'main' }
        };
        
        const result = await dynamodb.get(params).promise();
        
        if (result.Item) {
            console.log('📄 Current wedding content:');
            console.log('Last updated:', result.Item.lastUpdated);
            console.log('\nContent preview:');
            // Show first 200 characters of content
            const preview = result.Item.content.replace(/<[^>]*>/g, '').substring(0, 200);
            console.log(preview + '...');
            return result.Item;
        } else {
            console.log('❌ No wedding content found');
            return null;
        }
    } catch (error) {
        console.error('❌ Error retrieving wedding content:', error);
        return null;
    }
}

// Function to create the DynamoDB table (if it doesn't exist)
async function createTable() {
    const dynamodbClient = new AWS.DynamoDB({
        region: 'us-east-1' // Change to your preferred region
    });
    
    try {
        const params = {
            TableName: TABLE_NAME,
            KeySchema: [
                {
                    AttributeName: 'id',
                    KeyType: 'HASH'
                }
            ],
            AttributeDefinitions: [
                {
                    AttributeName: 'id',
                    AttributeType: 'S'
                }
            ],
            BillingMode: 'PAY_PER_REQUEST' // On-demand pricing
        };
        
        await dynamodbClient.createTable(params).promise();
        console.log('✅ Table created successfully!');
        
        // Wait for table to be active
        console.log('⏳ Waiting for table to be active...');
        await dynamodbClient.waitFor('tableExists', { TableName: TABLE_NAME }).promise();
        console.log('✅ Table is now active!');
        
    } catch (error) {
        if (error.code === 'ResourceInUseException') {
            console.log('ℹ️  Table already exists');
        } else {
            console.error('❌ Error creating table:', error);
        }
    }
}

// Command line interface
async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'create-table':
            await createTable();
            break;
            
        case 'update':
            await updateWeddingContent();
            break;
            
        case 'get':
            await getWeddingContent();
            break;
            
        case 'setup':
            console.log('🚀 Setting up wedding data management...');
            await createTable();
            await updateWeddingContent();
            console.log('✅ Setup complete!');
            break;
            
        default:
            console.log(`
📋 Wedding Data Management Commands:

node data-management.js setup          - Create table and add sample content
node data-management.js create-table   - Create DynamoDB table only
node data-management.js update         - Update wedding content with sample data
node data-management.js get            - View current wedding content

💡 Tips:
- Make sure AWS CLI is configured with proper credentials
- Update the region in this script if needed
- Modify sampleWeddingContent object to customize your content
- The content supports HTML for formatting
            `);
    }
}

// Export functions for use in other scripts
module.exports = {
    updateWeddingContent,
    getWeddingContent,
    createTable,
    sampleWeddingContent
};

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

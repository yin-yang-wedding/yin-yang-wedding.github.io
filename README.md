# Jessica and Will's Wedding Website

A secure, password-protected wedding website with AWS backend hosting for sensitive data.

## 🏗️ Architecture

This wedding website uses a secure architecture that keeps sensitive data in AWS while maintaining a public GitHub repository:

- **Frontend**: Static HTML/CSS/JavaScript hosted on GitHub Pages
- **Authentication**: Password-protected access with session management
- **Backend**: AWS Lambda + API Gateway for secure data retrieval
- **Data Storage**: AWS DynamoDB for wedding content + AWS Secrets Manager for passwords
- **Security**: All sensitive information stored in AWS, not in source code

## 🚀 Features

- ✅ **Password Protection**: Secure login system
- ✅ **AWS Integration**: Core data hosted securely on AWS
- ✅ **Public Source Code**: Repository can be public without exposing sensitive data
- ✅ **Easy Content Management**: Update wedding details without touching code
- ✅ **Responsive Design**: Works on all devices
- ✅ **Cost Effective**: ~$5/month AWS costs for typical usage

## 📁 Project Structure

```
├── index.html              # Public landing page
├── login.html              # Password entry page
├── protected.html           # Protected wedding content page
├── lambda-function.js       # AWS Lambda function code
├── data-management.js       # Script to manage wedding content
├── aws-setup.md            # Detailed AWS setup instructions
└── README.md               # This file
```

## 🛠️ Setup Instructions

### 1. Clone and Deploy Frontend

1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Your site will be available at `https://yourusername.github.io/repository-name`

### 2. Set Up AWS Backend

Follow the detailed instructions in [`aws-setup.md`](aws-setup.md) to:

1. Create DynamoDB table for wedding content
2. Set up AWS Secrets Manager for password storage
3. Create Lambda function for authentication and data retrieval
4. Configure API Gateway for secure HTTPS endpoint
5. Update frontend with your API URL

### 3. Manage Wedding Content

Use the included `data-management.js` script to easily manage your wedding content:

```bash
# Install AWS SDK (if not already installed)
npm install aws-sdk

# Set up everything (creates table and adds sample content)
node data-management.js setup

# Update wedding content
node data-management.js update

# View current content
node data-management.js get
```

## 🔒 Security Features

- **Password Storage**: Passwords stored securely in AWS Secrets Manager
- **Content Protection**: Wedding details stored in DynamoDB, not in source code
- **HTTPS Only**: All API communication over secure HTTPS
- **CORS Protection**: Properly configured cross-origin resource sharing
- **Minimal Permissions**: Lambda function has only required AWS permissions

## 💰 Cost Breakdown

**Estimated monthly costs for typical wedding site usage:**

| Service | Cost | Notes |
|---------|------|-------|
| DynamoDB | ~$1.25 | 25 GB free tier available |
| Lambda | ~$0.20 | 1M requests free tier |
| API Gateway | ~$3.50 | Per 1000 requests |
| Secrets Manager | ~$0.40 | Per secret per month |
| **Total** | **~$5.35** | Most services have generous free tiers |

## 🎨 Customization

### Updating Wedding Content

1. **Via Script** (Recommended):
   ```bash
   node data-management.js update
   ```

2. **Via AWS Console**:
   - Go to DynamoDB → WeddingData table
   - Edit the item with `id: "main"`
   - Update the `content` field with your HTML
   - Save changes

### Styling

Modify the CSS in `index.html`, `login.html`, and `protected.html` to match your wedding theme.

### Password

Update the password in AWS Secrets Manager:
1. Go to AWS Secrets Manager console
2. Find `wedding-site-password` secret
3. Update the password value
4. Save changes

## 🧪 Testing

1. Deploy your site to GitHub Pages
2. Visit the site and test login functionality
3. Check AWS CloudWatch logs for any errors
4. Verify content loads correctly after authentication

## 🔧 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure CORS is enabled on API Gateway
2. **403 Forbidden**: Check Lambda IAM role permissions
3. **500 Internal Server Error**: Check CloudWatch logs
4. **Content Not Loading**: Verify API URL in `protected.html`

### Debug Commands

```bash
# Test Lambda function
aws lambda invoke --function-name wedding-content --payload '{"body":"{\"password\":\"your-password\"}"}' response.json

# Check DynamoDB content
aws dynamodb get-item --table-name WeddingData --key '{"id":{"S":"main"}}'
```

## 📝 Development

### Local Development

Since this is a static site with AWS backend, you can:

1. Open HTML files directly in browser for frontend testing
2. Use AWS CLI to test Lambda functions
3. Use the data management script to update content

### Adding Features

The architecture supports easy extension:
- Add new Lambda functions for additional features
- Create new DynamoDB tables for guest lists, RSVPs, etc.
- Extend the frontend with new protected pages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 💡 Why This Architecture?

This setup solves a common problem: wanting to share your wedding website code publicly while keeping sensitive information private. By using AWS for data storage and authentication, you get:

- **Security**: Sensitive data never appears in your public repository
- **Flexibility**: Easy to update content without code changes
- **Scalability**: AWS handles traffic spikes automatically
- **Cost-Effective**: Pay only for what you use
- **Professional**: Enterprise-grade security and reliability

Perfect for couples who want a beautiful, secure wedding website without compromising on privacy or breaking the bank! 💒✨

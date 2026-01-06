# AWS Setup Instructions for Wedding Website

## Overview
This setup uses AWS services to securely host wedding data while keeping the source code public. The architecture includes:
- **AWS Secrets Manager**: Stores the password securely
- **DynamoDB**: Stores wedding content data
- **Lambda**: Handles authentication and data retrieval
- **API Gateway**: Provides secure HTTPS endpoint

## 1. Create DynamoDB Table

1. Go to AWS DynamoDB console
2. Create table:
   - **Table name**: `WeddingData`
   - **Partition key**: `id` (String)
   - **Settings**: Use default settings for cost optimization
3. Create an item with the following structure:
   ```json
   {
     "id": "main",
     "content": "<div class=\"content-section\"><h2>Ceremony Details</h2><p><strong>Date:</strong> June 15, 2024</p><p><strong>Time:</strong> 4:00 PM</p><p><strong>Location:</strong> Sunlight Gardens, 123 Main St</p></div><div class=\"content-section\"><h2>Reception</h2><p><strong>Time:</strong> 6:00 PM</p><p><strong>Location:</strong> Same Venue</p></div><div class=\"content-section\"><h2>RSVP</h2><p>Please RSVP by May 15</p><p>Contact: jessica.will.wedding@gmail.com</p></div>",
     "lastUpdated": "2024-01-15T10:00:00Z"
   }
   ```

## 2. Create AWS Secrets Manager Secret

1. Go to AWS Secrets Manager console
2. Create new secret:
   - **Secret type**: Other type of secret
   - **Key/value pairs**:
     ```json
     {
       "password": "your-secure-password-here"
     }
     ```
   - **Secret name**: `wedding-site-password`
   - **Description**: Password for wedding website access

## 3. Create IAM Role for Lambda

1. Go to AWS IAM console
2. Create role:
   - **Trusted entity type**: AWS service
   - **Service**: Lambda
   - This will automatically create the trust policy:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Principal": {
             "Service": "lambda.amazonaws.com"
           },
           "Action": "sts:AssumeRole"
         }
       ]
     }
     ```
3. Create and attach a custom permissions policy:
   - **Policy name**: `WeddingLambdaPolicy`
   - **Policy document**:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "logs:CreateLogGroup",
             "logs:CreateLogStream",
             "logs:PutLogEvents"
           ],
           "Resource": "arn:aws:logs:*:*:*"
         },
         {
           "Effect": "Allow",
           "Action": [
             "secretsmanager:GetSecretValue"
           ],
           "Resource": "arn:aws:secretsmanager:*:*:secret:wedding-site-password-*"
         },
         {
           "Effect": "Allow",
           "Action": [
             "dynamodb:GetItem"
           ],
           "Resource": "arn:aws:dynamodb:*:*:table/WeddingData"
         }
       ]
     }
     ```
4. **Role name**: `WeddingLambdaRole`

## 4. Create Lambda Function

1. Go to AWS Lambda console
2. Create function:
   - **Function name**: `wedding-content`
   - **Runtime**: Node.js 18.x
   - **Execution role**: Use existing role `WeddingLambdaRole`
3. Copy code from `lambda-function.js`
4. **Important**: Set timeout to 30 seconds (Configuration → General configuration)

## 5. Create API Gateway

1. Go to API Gateway console
2. Create REST API:
   - **API name**: `wedding-api`
   - **Description**: API for wedding website content
3. Create resource:
   - **Resource name**: `content`
   - **Resource path**: `/content`
4. Create POST method:
   - **Integration type**: Lambda Function
   - **Lambda function**: Select `wedding-content`
   - **Use Lambda Proxy integration**: ✓ (checked)
5. Enable CORS:
   - Actions → Enable CORS
   - **Access-Control-Allow-Origin**: `*`
   - **Access-Control-Allow-Headers**: `Content-Type`
   - **Access-Control-Allow-Methods**: `POST,OPTIONS`

## 6. Deploy API

1. Actions → Deploy API
2. **Deployment stage**: Create new stage `prod`
3. **Stage description**: Production stage
4. Copy the **Invoke URL** (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/prod`)

## 7. Update Frontend Configuration

1. Open `protected.html`
2. Update the `API_URL` constant with your API Gateway URL:
   ```javascript
   const API_URL = 'https://your-actual-api-url.amazonaws.com/prod/content';
   ```

## 8. Test the Setup

1. Deploy your website to GitHub Pages
2. Visit the site and test the login functionality
3. Check AWS CloudWatch logs for any errors

## 9. Security Best Practices

### Implemented:
- Password stored in AWS Secrets Manager
- Wedding content stored in DynamoDB (not in source code)
- CORS properly configured
- Lambda function has minimal required permissions

### Additional Recommendations:
- **Rate Limiting**: Add AWS WAF to prevent brute force attacks
- **Custom Domain**: Use Route 53 and CloudFront for better security
- **Monitoring**: Set up CloudWatch alarms for failed authentication attempts
- **Backup**: Enable DynamoDB point-in-time recovery

## 10. Updating Wedding Content

To update wedding details without touching code:

1. Go to DynamoDB console
2. Open `WeddingData` table
3. Edit the item with `id: "main"`
4. Update the `content` field with new HTML
5. Update the `lastUpdated` timestamp
6. Save changes

The website will immediately reflect the new content!

## Cost Estimation

**Monthly costs for typical wedding site usage (1000 requests/month):**
- DynamoDB: ~$1.25/month (25 GB free tier)
- Lambda: ~$0.20/month (1M requests free tier)
- API Gateway: ~$3.50/month
- Secrets Manager: ~$0.40/month
- **Total**: ~$5.35/month

**Note**: Most services have generous free tiers, so actual costs may be lower.

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Ensure CORS is enabled on API Gateway and Lambda returns proper headers
2. **403 Forbidden**: Check IAM role permissions for Lambda
3. **500 Internal Server Error**: Check CloudWatch logs for Lambda function errors
4. **Password Not Working**: Verify the secret name and format in Secrets Manager

### Useful AWS CLI Commands:

```bash
# Test Lambda function locally
aws lambda invoke --function-name wedding-content --payload '{"body":"{\"password\":\"your-password\"}"}' response.json

# Check DynamoDB item
aws dynamodb get-item --table-name WeddingData --key '{"id":{"S":"main"}}'

# View recent Lambda logs
aws logs describe-log-streams --log-group-name /aws/lambda/wedding-content --order-by LastEventTime --descending

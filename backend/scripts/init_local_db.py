import boto3
import os
import sys

def init_db():
    endpoint_url = os.getenv('DYNAMODB_ENDPOINT_URL', 'http://localhost:8000')
    table_name = os.getenv('DYNAMODB_TABLE', 'TimeChunks')
    region_name = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')

    print(f"Initializing Local DynamoDB at {endpoint_url}...")
    
    dynamodb = boto3.resource(
        'dynamodb',
        region_name=region_name,
        endpoint_url=endpoint_url,
        aws_access_key_id='local',
        aws_secret_access_key='local'
    )

    try:
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                {'AttributeName': 'chunk_id', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'user_id', 'AttributeType': 'S'},
                {'AttributeName': 'chunk_id', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
        )
        table.meta.client.get_waiter('table_exists').wait(TableName=table_name)
        print(f"Successfully created table: {table_name}")
    except Exception as e:
        if 'ResourceInUseException' in str(e):
            print(f"Table {table_name} already exists.")
        else:
            print(f"Error creating table: {e}")
            sys.exit(1)

if __name__ == "__main__":
    init_db()

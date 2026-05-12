import boto3
import os
from boto3.dynamodb.conditions import Key
from uuid import uuid4
from .models import TimeChunkResponse, TimeChunkCreate, Task

def get_table():
    endpoint_url = os.getenv('DYNAMODB_ENDPOINT_URL')
    if endpoint_url:
        dynamodb = boto3.resource(
            'dynamodb',
            region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1'),
            endpoint_url=endpoint_url
        )
    else:
        dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1'))
    return dynamodb.Table(os.getenv('DYNAMODB_TABLE', 'TimeChunks'))

def get_chunks(user_id: str) -> list[TimeChunkResponse]:
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('user_id').eq(user_id)
    )
    items = response.get('Items', [])
    while 'LastEvaluatedKey' in response:
        response = table.query(
            KeyConditionExpression=Key('user_id').eq(user_id),
            ExclusiveStartKey=response['LastEvaluatedKey']
        )
        items.extend(response.get('Items', []))
    return [TimeChunkResponse(**item) for item in items]

def create_chunk(user_id: str, chunk: TimeChunkCreate) -> TimeChunkResponse:
    table = get_table()
    chunk_id = str(uuid4())
    item = {
        'user_id': user_id,
        'chunk_id': chunk_id,
        'title': chunk.title,
        'start_time': chunk.start_time.isoformat(),
        'end_time': chunk.end_time.isoformat(),
        'is_template': chunk.is_template,
        'tasks': [task.model_dump(mode='json') for task in chunk.tasks]
    }
    table.put_item(Item=item)
    return TimeChunkResponse(**item)

def update_chunk_tasks(user_id: str, chunk_id: str, tasks: list[Task]) -> TimeChunkResponse:
    table = get_table()
    tasks_dict = [task.model_dump(mode='json') for task in tasks]
    response = table.update_item(
        Key={'user_id': user_id, 'chunk_id': chunk_id},
        UpdateExpression="SET tasks = :tasks",
        ExpressionAttributeValues={':tasks': tasks_dict},
        ConditionExpression="attribute_exists(chunk_id)",
        ReturnValues="ALL_NEW"
    )
    return TimeChunkResponse(**response.get('Attributes', {}))

def delete_chunk(user_id: str, chunk_id: str):
    table = get_table()
    table.delete_item(
        Key={'user_id': user_id, 'chunk_id': chunk_id},
        ConditionExpression="attribute_exists(chunk_id)"
    )

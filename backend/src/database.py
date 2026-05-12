import boto3
import botocore.exceptions
import os
from boto3.dynamodb.conditions import Key
from uuid import uuid4
from .models import TimeChunkResponse, TimeChunkCreate, Task, TimeChunkUpdate

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

def update_chunk(user_id: str, chunk_id: str, update: TimeChunkUpdate) -> TimeChunkResponse:
    table = get_table()

    set_clauses: list[str] = []
    values: dict[str, object] = {}

    if update.tasks is not None:
        set_clauses.append("tasks = :tasks")
        values[":tasks"] = [task.model_dump(mode='json') for task in update.tasks]
    if update.start_time is not None:
        set_clauses.append("start_time = :start_time")
        values[":start_time"] = update.start_time.isoformat()
    if update.end_time is not None:
        set_clauses.append("end_time = :end_time")
        values[":end_time"] = update.end_time.isoformat()

    if not set_clauses:
        # No-op partial update: verify the chunk exists, return current state.
        # We surface chunk-not-found by raising the same ClientError shape that
        # update_item produces, so routes.py can keep a single 404 handler.
        response = table.get_item(Key={'user_id': user_id, 'chunk_id': chunk_id})
        item = response.get('Item')
        if item is None:
            raise botocore.exceptions.ClientError(
                {'Error': {'Code': 'ConditionalCheckFailedException', 'Message': 'Chunk not found'}},
                'GetItem'
            )
        return TimeChunkResponse(**item)

    response = table.update_item(
        Key={'user_id': user_id, 'chunk_id': chunk_id},
        UpdateExpression="SET " + ", ".join(set_clauses),
        ExpressionAttributeValues=values,
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

import os
import datetime
import logging
import boto3
from botocore.config import Config
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cloudflare R2 Configuration (Use environment variables for security)
# You should add these to your .env file
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "smilecare-backups")

def get_r2_client():
    """Connect to Cloudflare R2."""
    if not all([R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID]):
        logger.warning("Cloudflare R2 credentials missing. Cloud backup skipped.")
        return None
    
    try:
        s3_endpoint_url = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        
        s3 = boto3.client(
            "s3",
            endpoint_url=s3_endpoint_url,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )
        return s3
    except Exception as e:
        logger.error(f"Failed to connect to Cloudflare R2: {e}")
        return None

def get_or_create_folder(service, folder_name):
    """Checks if a folder exists on Google Drive, or creates it."""
    try:
        query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        results = service.files().list(q=query, fields="files(id, name)").execute()
        items = results.get('files', [])
        if items:
            return items[0]['id']
        else:
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            file = service.files().create(body=file_metadata, fields='id').execute()
            return file.get('id')
    except Exception as e:
        logger.error(f"Error creating/finding folder: {e}")
        return None

def upload_database_to_r2(db_path, clinic_name):
    """Uploads a specific database file to Cloudflare R2, creating bucket if needed."""
    s3 = get_r2_client()
    if not s3:
        return False

    if not os.path.exists(db_path):
        logger.error(f"Database file not found: {db_path}")
        return False

    try:
        # Check if bucket exists, create if not
        try:
            s3.head_bucket(Bucket=R2_BUCKET_NAME)
        except:
            logger.info(f"Bucket {R2_BUCKET_NAME} not found. Creating it...")
            s3.create_bucket(Bucket=R2_BUCKET_NAME)

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M")
        file_key = f"backups/{clinic_name}/{clinic_name}_{timestamp}.db"

        s3.upload_file(db_path, R2_BUCKET_NAME, file_key)
        logger.info(f"Successfully backed up {clinic_name} to Cloudflare R2. Key: {file_key}")
        
        # Cleanup old backups (Keep only last 30 days)
        cleanup_old_backups(s3, clinic_name)
        
        return True
    except Exception as e:
        logger.error(f"Failed to upload {clinic_name} to R2: {e}")
        return False

def cleanup_old_backups(s3, clinic_name, retention_days=30):
    """Deletes backups older than the retention period."""
    try:
        prefix = f"backups/{clinic_name}/"
        response = s3.list_objects_v2(Bucket=R2_BUCKET_NAME, Prefix=prefix)
        
        if 'Contents' not in response:
            return

        now = datetime.datetime.now(datetime.timezone.utc)
        delete_count = 0

        for obj in response['Contents']:
            last_modified = obj['LastModified']
            age = now - last_modified
            
            if age.days > retention_days:
                s3.delete_object(Bucket=R2_BUCKET_NAME, Key=obj['Key'])
                delete_count += 1
        
        if delete_count > 0:
            logger.info(f"Cleaned up {delete_count} old backups for {clinic_name}.")
    except Exception as e:
        logger.error(f"Failed to cleanup old backups for {clinic_name}: {e}")

def upload_to_personal_drive(db_path, clinic_name, refresh_token):
    """Uploads a backup to a doctor's personal Google Drive."""
    try:
        from google.oauth2.credentials import Credentials as GoogleCredentials
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
        from google.auth.transport.requests import Request
        
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            logger.error("Google Client ID/Secret missing for personal backup.")
            return False

        creds = GoogleCredentials(
            None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
        )
        
        # Refresh the access token
        creds.refresh(Request())
        
        service = build('drive', 'v3', credentials=creds)
        
        # Find or create folder
        folder_id = get_or_create_folder(service, "SmileCare_My_Backups")
        
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M")
        file_name = f"My_SmileCare_Backup_{timestamp}.db"
        
        file_metadata = {'name': file_name, 'parents': [folder_id]}
        media = MediaFileUpload(db_path, mimetype='application/x-sqlite3', resumable=True)
        
        file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        logger.info(f"Successfully backed up {clinic_name} to personal Google Drive. ID: {file.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed personal backup for {clinic_name}: {e}")
        return False

def run_daily_company_backup():
    """Finds all clinic databases and backs them up to R2 and Personal Drive."""
    logger.info("Starting automated daily cloud backup...")
    
    base_dir = os.path.dirname(__file__)
    db_folder = os.path.abspath(os.path.join(base_dir, "..", "databases"))
    
    if not os.path.exists(db_folder):
        logger.warning(f"Databases folder not found at {db_folder}")
        return

    import sqlite3
    success_count = 0
    fail_count = 0

    for filename in os.listdir(db_folder):
        if filename.endswith(".db") and filename != "master.db":
            db_path = os.path.join(db_folder, filename)
            clinic_name = filename.replace(".db", "")
            
            # 1. Company Backup (R2)
            upload_database_to_r2(db_path, clinic_name)
            
            # 2. Personal Backup (Google Drive) - if linked
            try:
                conn = sqlite3.connect(db_path)
                res = conn.execute("SELECT value FROM settings WHERE key='google_refresh_token'").fetchone()
                conn.close()
                
                if res and res[0]:
                    logger.info(f"Linking found for {clinic_name}. Attempting personal backup...")
                    upload_to_personal_drive(db_path, clinic_name, res[0])
            except:
                pass
                
            success_count += 1

    logger.info(f"Daily backup process finished. Processed: {success_count}")

if __name__ == '__main__':
    run_daily_company_backup()

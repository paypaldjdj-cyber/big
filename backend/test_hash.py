from werkzeug.security import generate_password_hash, check_password_hash
p = "testpass"
hp = generate_password_hash(p)
print(f"Password: {p}")
print(f"Hash: {hp}")
print(f"Match? {check_password_hash(hp, p)}")

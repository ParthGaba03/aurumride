import argparse

from backend.app.core.security import hash_password
from backend.app.db.init_db import init_db
from backend.app.db.session import SessionLocal
from backend.app.models.user import User, UserRole


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or promote an admin user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=False, help="If creating new user, set this password.")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if user:
            user.role = UserRole.admin
            db.commit()
            print(f"Promoted existing user to admin: {user.email}")
            return

        if not args.password:
            raise SystemExit("Password required when creating a new admin user.")

        user = User(email=args.email, password_hash=hash_password(args.password), role=UserRole.admin)
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created admin user: {user.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()


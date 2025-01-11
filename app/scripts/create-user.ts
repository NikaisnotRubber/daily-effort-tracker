import { db } from "../utils/db.server";
import bcrypt from "bcryptjs";

async function createUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await db.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
      },
    });
    console.log(`Created user: ${user.email}`);
  } catch (error) {
    console.error("Error creating user:", error);
  }
}

// You can run this script with: npx ts-node app/scripts/create-user.ts "email@example.com" "password"
const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Please provide both email and password");
  process.exit(1);
}

createUser(email, password)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

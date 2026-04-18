import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set } from 'firebase/database'
import { readFileSync } from 'fs'
import { config } from 'dotenv'

config()

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

const { study_spots } = JSON.parse(readFileSync('./study_spots.json', 'utf8'))

async function seed() {
  console.log(`Seeding ${study_spots.length} spots...`)

  for (const spot of study_spots) {
    const { current_status, last_reported, report_count, ...spotData } = spot
    await set(ref(db, `spots/${spot.id}`), spotData)
    console.log(`  ✓ ${spot.display_name}`)
  }

  // Initialize bookings as empty object so Firebase path exists
  await set(ref(db, 'bookings'), {})

  console.log(`Done — ${study_spots.length} spots seeded, bookings initialized.`)
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})

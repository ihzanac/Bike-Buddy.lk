import {
  collection,
  getCountFromServer,
  query,
  where,
} from 'firebase/firestore'
import { requireDb } from '@/services/firebase'

export async function getAdminCounts() {
  const database = requireDb()
  const usersCol = collection(database, 'users')
  const [users, bikes, accessories, bookings, services, ownersPending] =
    await Promise.all([
      getCountFromServer(query(usersCol)),
      getCountFromServer(query(collection(database, 'bikes'))),
      getCountFromServer(query(collection(database, 'accessories'))),
      getCountFromServer(query(collection(database, 'bookings'))),
      getCountFromServer(query(collection(database, 'services'))),
      getCountFromServer(
        query(usersCol, where('ownerStatus', '==', 'pending')),
      ),
    ])

  return {
    users: users.data().count,
    bikes: bikes.data().count,
    accessories: accessories.data().count,
    bookings: bookings.data().count,
    services: services.data().count,
    ownersPending: ownersPending.data().count,
  }
}

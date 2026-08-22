// db.ts
import { Dexie, type EntityTable } from "dexie"

interface Document {
  id: number
  name: string
  content: string
}

const db = new Dexie("Documents") as Dexie & {
  documents: EntityTable<
    Document,
    "id" // primary key "id" (for the typings only)
  >
}

// Schema declaration:
db.version(1).stores({
  documents: "++id, name, content",  // primary key "id" (for the runtime!)
})

export type { Document }
export { db }

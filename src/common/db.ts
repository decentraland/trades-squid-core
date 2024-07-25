import { TypeormDatabase } from '@subsquid/typeorm-store'
import { Network } from '../model'

const schema = process.env.DB_SCHEMA

export function getDb(network: Network) {
  return new TypeormDatabase({
    isolationLevel: 'READ COMMITTED',
    stateSchema: `${network}_processor_${schema}`
  })
}

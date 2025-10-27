import { Store } from '@subsquid/typeorm-store'
import { EntityManager } from 'typeorm'
import { Trade as SquidTrade, TradeAction } from '../../model'
import eventPublisher from './event_publisher'

export async function getLastNotified(store: Store): Promise<bigint | null> {
  const em = (store as unknown as { em: () => EntityManager }).em()
  const lastNotified = (await em.query("SELECT last_notified FROM public.squids WHERE name = 'trades'"))[0].last_notified
  return lastNotified && BigInt(lastNotified)
}

export async function setLastNotified(store: Store, timestamp: bigint) {
  const em = (store as unknown as { em: () => EntityManager }).em()
  await em.query(`UPDATE public.squids SET last_notified = ${timestamp} WHERE name = 'trades'`)
}

export async function sendEvents(store: Store, modifiedTrades: SquidTrade[], timestamp: bigint) {
  try {
    const lastNotified = await getLastNotified(store)
    const MARKETPLACE_API_URL = process.env.MARKETPLACE_API_URL
    const events = (
      await Promise.all(
        modifiedTrades
          .filter(trade => trade.action === TradeAction.executed)
          .filter(trade => !lastNotified || trade.timestamp > lastNotified)
          .map(async trade => {
            const url = `${MARKETPLACE_API_URL}/trades/${trade.signature}/accept?timestamp=${trade.timestamp}&caller=${trade.receivedBeneficiary}`
            console.log('url', url)
            try {
              const response = await fetch(url)
              if (!response.ok) {
                throw Error(response.statusText)
              }
              const body = await response.json()
              return body.data
            } catch (e) {
              console.log(
                `Error sending event for trade ${trade.signature}, timestamp ${trade.timestamp}, caller ${trade.receivedBeneficiary}. URL: ${url}. Error: ${e}`
              )
            }
          })
      )
    ).filter(Boolean)

    await Promise.all(events.map(event => eventPublisher.publishMessage(event)))

    if (events.length > 0) {
      console.log('[events] Setting last notified timestamp:', timestamp)
      // Only set the last notified timestamp if we successfully sent at least one event
      await setLastNotified(store, timestamp)
    }
  } catch (e) {
    console.log('Error in sendEvents:', e)
    console.log(
      'Could not send events for trades with hash',
      modifiedTrades.map(trade => trade.signature)
    )
  }
}

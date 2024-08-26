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
            try {
              const response = await (
                await fetch(`${MARKETPLACE_API_URL}/v1/trades/${trade.signature}/accept?timestamp=${trade.timestamp}`)
              ).json()
              return response.ok ? response.data : null
            } catch (e) {
              console.log(e)
            }
          })
      )
    ).filter(Boolean)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    await Promise.all(events.map(eventPublisher.publishMessage))

    await setLastNotified(store, timestamp)
  } catch (e) {
    console.log(
      'Could not send events for trades with hash',
      modifiedTrades.map(trade => trade.signature)
    )
  }
}

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { Event } from '@dcl/schemas'

class EventPublisher {
  snsArn = process.env.AWS_SNS_ARN
  endpoint = process.env.AWS_SNS_ENDPOINT
  client = new SNSClient({ endpoint: this.endpoint })

  async publishMessage(event: Event): Promise<string | undefined> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { MessageId } = await this.client.send(
      new PublishCommand({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        TopicArn: this.snsArn,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Message: JSON.stringify(event)
      })
    )

    return MessageId
  }
}

export default new EventPublisher()

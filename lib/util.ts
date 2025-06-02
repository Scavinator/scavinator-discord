import { RESTJSONErrorCodes, DiscordAPIError } from "discord.js";

export async function handleRESTError<t>(f: Promise<t>, code: RESTJSONErrorCodes, handler: () => Promise<t>): Promise<t> {
  try {
    return await f
  } catch (e) {
    if (e instanceof DiscordAPIError && e.code === code) {
      return await handler()
    } else {
      throw e
    }
  }
}

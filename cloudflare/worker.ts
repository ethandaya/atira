import { Container, getContainer } from '@cloudflare/containers'

export class AtiraContainer extends Container {
  defaultPort = 8080
  sleepAfter = '30m'
}

type Env = {
  ATIRA_CONTAINER: DurableObjectNamespace<AtiraContainer>
}

export default {
  fetch(request, env) {
    return getContainer(env.ATIRA_CONTAINER).fetch(request)
  },
} satisfies ExportedHandler<Env>

import { hash } from '@ember/helper';
import Card from './card';

const Greeting = <template>
  <p class="greeting">Hello, {{@name}}!</p>
</template>;

const Avatar = <template><img src={{@src}} alt={{@alt}} /></template>;

export default <template>
  <Card @title="Profile" @options={{hash compact=@compact}}>
    <Avatar @src={{@user.avatarUrl}} @alt={{@user.name}} />
    <Greeting @name={{@user.name}} />
  </Card>
</template>

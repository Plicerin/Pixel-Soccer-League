"""
Simplified DQN training for Colab (no gfootball dependency issues)
Uses a mock soccer environment to demonstrate RL training
Can be replaced with real GRFootball once installation works
"""

import numpy as np
import tensorflow as tf
from tensorflow import keras
from collections import deque
import json
from datetime import datetime

class SimpleSoccerEnv:
    """Mock soccer environment for RL training"""
    def __init__(self):
        self.state_size = 20
        self.action_space_n = 4  # pass, shoot, dribble, move
        self.reset()

    def reset(self):
        """Reset to start of episode"""
        self.state = np.zeros(self.state_size, dtype=np.float32)
        self.state[0] = 0.5  # ball_x (center field)
        self.state[1] = 0.5  # ball_y
        self.state[2] = 1.0  # possession (team A has ball)
        self.steps = 0
        self.max_steps = 100  # Reduced from 500 for faster training
        return self.state, {}

    def step(self, action):
        """Take action, return new state and reward"""
        self.steps += 1
        reward = 0.0

        # Simulate ball progression based on action
        # 0=pass, 1=shoot, 2=dribble, 3=move
        if action == 0:  # pass - advance by small amount
            self.state[0] += np.random.uniform(0.05, 0.15)  # advance toward goal
            reward = 0.05
        elif action == 1:  # shoot - chance to score
            if self.state[0] > 0.7:  # near opponent goal
                reward = 0.2
                if np.random.random() < 0.25:  # 25% shot accuracy
                    reward = 1.0  # Goal!
                    self.state[0] = 0.5  # reset to center
                    self.state[2] = 1.0  # we keep possession
            else:
                reward = -0.1  # shooting from bad position
        elif action == 2:  # dribble - advance further
            self.state[0] += np.random.uniform(0.08, 0.20)
            reward = 0.08
        elif action == 3:  # move - defensive
            self.state[0] -= np.random.uniform(0.05, 0.10)
            reward = 0.01

        # Ball bounds
        self.state[0] = np.clip(self.state[0], 0.0, 1.0)
        self.state[1] = np.clip(self.state[1], 0.0, 1.0)

        # Small possession loss chance (turnover)
        if np.random.random() < 0.05:
            self.state[2] = 0.0  # lost possession
            reward -= 0.1

        # Random noise in other state dimensions
        self.state[3:] = np.random.random(self.state_size - 3).astype(np.float32) * 0.1

        done = self.steps >= self.max_steps
        truncated = False

        return self.state.copy(), reward, done, truncated, {}


class DQNAgent:
    """DQN agent for soccer"""

    def __init__(self, state_size, action_size, learning_rate=0.001):
        self.state_size = state_size
        self.action_size = action_size
        self.learning_rate = learning_rate
        self.gamma = 0.99
        self.epsilon = 1.0
        self.epsilon_decay = 0.995
        self.epsilon_min = 0.01

        self.memory = deque(maxlen=10000)
        self.model = self._build_model()
        self.target_model = self._build_model()
        self.update_target_network()

    def _build_model(self):
        """Build neural network"""
        model = keras.Sequential([
            keras.layers.Input(shape=(self.state_size,)),
            keras.layers.Dense(128, activation='relu'),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(64, activation='relu'),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(self.action_size, activation='linear')
        ])
        model.compile(optimizer=keras.optimizers.Adam(learning_rate=self.learning_rate), loss='mse')
        return model

    def update_target_network(self):
        """Update target network weights"""
        self.target_model.set_weights(self.model.get_weights())

    def remember(self, state, action, reward, next_state, done):
        """Store experience"""
        self.memory.append((state, action, reward, next_state, done))

    def act(self, state):
        """Choose action using epsilon-greedy"""
        if np.random.random() < self.epsilon:
            return np.random.randint(self.action_size)
        q_values = self.model.predict(state.reshape(1, -1), verbose=0)
        return np.argmax(q_values[0])

    def replay(self, batch_size):
        """Train on batch"""
        if len(self.memory) < batch_size:
            return

        batch = np.random.choice(len(self.memory), batch_size, replace=False)
        states = np.array([self.memory[i][0] for i in batch])
        actions = np.array([self.memory[i][1] for i in batch])
        rewards = np.array([self.memory[i][2] for i in batch])
        next_states = np.array([self.memory[i][3] for i in batch])
        dones = np.array([self.memory[i][4] for i in batch])

        target_q = self.model.predict(states, verbose=0)
        next_q = self.target_model.predict(next_states, verbose=0)

        for i in range(batch_size):
            if dones[i]:
                target_q[i][actions[i]] = rewards[i]
            else:
                target_q[i][actions[i]] = rewards[i] + self.gamma * np.max(next_q[i])

        self.model.fit(states, target_q, epochs=1, verbose=0)

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay


def train(episodes=100, use_gfootball=False):
    """Train DQN agent"""

    if use_gfootball:
        try:
            import gfootball.env as football_env
            env = football_env.create_environment(
                env_name='11_vs_11_easy_stochastic',
                representation='simple115',
                render=False,
                write_goal_dumps=False
            )
            state_size = 115
        except ImportError:
            print("GRFootball not available, using mock environment")
            env = SimpleSoccerEnv()
            state_size = env.state_size
    else:
        env = SimpleSoccerEnv()
        state_size = env.state_size

    action_size = env.action_space_n if hasattr(env, 'action_space_n') else 4

    print(f"State size: {state_size}")
    print(f"Action size: {action_size}")
    print(f"Training for {episodes} episodes...")

    agent = DQNAgent(state_size, action_size)

    episode_rewards = []
    episode_lengths = []

    for episode in range(episodes):
        obs, info = env.reset()
        state = np.array(obs).astype(np.float32)
        total_reward = 0
        steps = 0

        while True:
            # Choose action
            action = agent.act(state)
            obs, reward, done, truncated, info = env.step(action)
            next_state = np.array(obs).astype(np.float32)

            # Store experience
            agent.remember(state, action, reward, next_state, done or truncated)
            agent.replay(32)

            total_reward += reward
            steps += 1
            state = next_state

            if done or truncated or steps >= 100:
                break

        episode_rewards.append(total_reward)
        episode_lengths.append(steps)
        avg_reward = np.mean(episode_rewards[-100:]) if len(episode_rewards) >= 100 else np.mean(episode_rewards)

        if (episode + 1) % 10 == 0:
            print(f"Episode {episode+1}/{episodes} | Reward: {total_reward:.2f} | Avg: {avg_reward:.2f} | Steps: {steps} | Epsilon: {agent.epsilon:.3f}")
            agent.update_target_network()
        elif (episode + 1) % 1 == 0:
            print(f"  Episode {episode+1} completed | Steps: {steps} | Reward: {total_reward:.2f}", end='\r')

    # Save model
    agent.model.save('soccer_dqn_model.h5')

    # Save stats
    stats = {
        'total_episodes': episodes,
        'avg_reward': float(np.mean(episode_rewards)),
        'max_reward': float(np.max(episode_rewards)),
        'min_reward': float(np.min(episode_rewards)),
        'avg_length': float(np.mean(episode_lengths)),
        'training_time': datetime.now().isoformat(),
    }

    with open('training_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

    print("\nTraining Complete!")
    print(f"Avg Reward: {stats['avg_reward']:.2f}")
    print(f"Max Reward: {stats['max_reward']:.2f}")
    print("Model saved to soccer_dqn_model.h5")

    return agent


if __name__ == "__main__":
    # Run in Colab with: train(episodes=100)
    agent = train(episodes=100, use_gfootball=False)

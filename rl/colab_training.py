"""
Google Research Football RL Training for Pixel Soccer League
Runs in Google Colab, trains DQN agent on GRFootball environment
Transfer results back to PSL game engine
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TF warnings

import numpy as np
import tensorflow as tf
from tensorflow import keras
from collections import deque
import json
from datetime import datetime

# Install gfootball if needed
import subprocess
import sys

def install_gfootball():
    """Install Google Research Football in Colab"""
    try:
        import gfootball
        print("gfootball already installed")
    except ImportError:
        print("Installing google-research-football...")
        # Install build dependencies first
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "cmake", "patchelf"])
        # Then install gfootball
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "google-research-football==2.11.0"])

install_gfootball()

import gfootball.env as football_env

class DQNAgent:
    """DQN agent for GRFootball"""

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
            keras.layers.Dense(256, activation='relu'),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(128, activation='relu'),
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

def train_on_grfootball(episodes=100):
    """Train DQN on Google Research Football"""

    # Create environment
    env = football_env.create_environment(
        env_name='11_vs_11_easy_stochastic',
        representation='simple115',
        render=False,
        write_goal_dumps=False
    )

    state_size = 115  # GRFootball simple115 observation
    action_size = env.action_space.n

    print(f"State size: {state_size}")
    print(f"Action size: {action_size}")

    agent = DQNAgent(state_size, action_size)

    episode_rewards = []
    episode_lengths = []

    for episode in range(episodes):
        obs, info = env.reset()
        state = np.array(obs)
        total_reward = 0
        steps = 0

        while True:
            # Choose action
            action = agent.act(state)
            obs, reward, done, truncated, info = env.step(action)
            next_state = np.array(obs)

            # Store experience
            agent.remember(state, action, reward, next_state, done or truncated)
            agent.replay(32)

            total_reward += reward
            steps += 1
            state = next_state

            if done or truncated or steps >= 500:
                break

        episode_rewards.append(total_reward)
        episode_lengths.append(steps)
        avg_reward = np.mean(episode_rewards[-100:])

        print(f"Episode {episode+1}/{episodes} | Reward: {total_reward:.2f} | Avg: {avg_reward:.2f} | Steps: {steps} | Epsilon: {agent.epsilon:.3f}")

        # Update target network every 10 episodes
        if (episode + 1) % 10 == 0:
            agent.update_target_network()

    # Save model
    agent.model.save('grfootball_dqn_model.h5')

    # Save stats
    stats = {
        'total_episodes': episodes,
        'avg_reward': float(np.mean(episode_rewards)),
        'max_reward': float(np.max(episode_rewards)),
        'min_reward': float(np.min(episode_rewards)),
        'avg_length': float(np.mean(episode_lengths)),
        'training_time': datetime.now().isoformat(),
    }

    with open('grfootball_training_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

    print("\nTraining Complete!")
    print(f"Avg Reward: {stats['avg_reward']:.2f}")
    print(f"Max Reward: {stats['max_reward']:.2f}")
    print("Model saved to grfootball_dqn_model.h5")

    return agent

if __name__ == "__main__":
    print("Starting GRFootball RL Training...")
    agent = train_on_grfootball(episodes=100)

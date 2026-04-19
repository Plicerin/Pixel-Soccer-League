# Deep Q-Network Agent for PSL training
# Uses experience replay and target network for stable learning

import numpy as np
import tensorflow as tf
from tensorflow import keras
from collections import deque
import os
from typing import Tuple

class DQNAgent:
    """Deep Q-Network agent for PSL decision making"""

    def __init__(self, state_size: int, action_size: int, config):
        self.state_size = state_size
        self.action_size = action_size
        self.config = config

        # Replay memory
        self.replay_buffer = deque(maxlen=config.REPLAY_BUFFER_SIZE)

        # Epsilon-greedy exploration
        self.epsilon = 1.0
        self.epsilon_decay = config.EPSILON_DECAY
        self.epsilon_min = config.EPSILON_MIN

        # Build networks
        self.model = self._build_network()
        self.target_model = self._build_network()
        self.update_target_network()

        self.step_count = 0

    def _build_network(self) -> keras.Model:
        """Build DQN network"""
        model = keras.Sequential([
            keras.layers.Input(shape=(self.state_size,)),
            keras.layers.Dense(self.config.HIDDEN_LAYER_1, activation='relu'),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(self.config.HIDDEN_LAYER_2, activation='relu'),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(self.action_size, activation='linear')
        ])

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=self.config.LEARNING_RATE),
            loss='mse'
        )

        return model

    def update_target_network(self):
        """Update target network with main network weights"""
        self.target_model.set_weights(self.model.get_weights())

    def remember(self, state: np.ndarray, action: int, reward: float, next_state: np.ndarray, done: bool):
        """Store experience in replay buffer"""
        self.replay_buffer.append((state, action, reward, next_state, done))

    def act(self, state: np.ndarray) -> int:
        """Choose action using epsilon-greedy policy"""
        if np.random.random() < self.epsilon:
            return np.random.randint(self.action_size)

        q_values = self.model.predict(state.reshape(1, -1), verbose=0)
        return np.argmax(q_values[0])

    def replay(self, batch_size: int):
        """Train on batch from replay buffer"""
        if len(self.replay_buffer) < batch_size:
            return

        batch = np.random.choice(len(self.replay_buffer), batch_size, replace=False)

        states = np.array([self.replay_buffer[i][0] for i in batch])
        actions = np.array([self.replay_buffer[i][1] for i in batch])
        rewards = np.array([self.replay_buffer[i][2] for i in batch])
        next_states = np.array([self.replay_buffer[i][3] for i in batch])
        dones = np.array([self.replay_buffer[i][4] for i in batch])

        # Predict Q-values for next state
        next_q_values = self.target_model.predict(next_states, verbose=0)
        next_max_q = np.max(next_q_values, axis=1)

        # Compute target Q-values
        target_q = self.model.predict(states, verbose=0)
        for i in range(batch_size):
            if dones[i]:
                target_q[i][actions[i]] = rewards[i]
            else:
                target_q[i][actions[i]] = rewards[i] + self.config.DISCOUNT_FACTOR * next_max_q[i]

        # Train network
        self.model.fit(states, target_q, epochs=1, verbose=0)

        # Decay epsilon
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

        self.step_count += 1

        # Update target network periodically
        if self.step_count % self.config.TARGET_NETWORK_UPDATE == 0:
            self.update_target_network()

    def save(self, path: str):
        """Save model weights"""
        self.model.save(os.path.join(path, "dqn_model.h5"))
        print(f"Model saved to {path}")

    def load(self, path: str):
        """Load model weights"""
        try:
            self.model = keras.models.load_model(os.path.join(path, "dqn_model.h5"))
            self.update_target_network()
            print(f"Model loaded from {path}")
            return True
        except Exception as e:
            print(f"Could not load model: {e}")
            return False

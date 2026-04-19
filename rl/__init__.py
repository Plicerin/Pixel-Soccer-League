"""
Pixel Soccer League - Reinforcement Learning Module

Implements DQN training for game AI using Google Research Football framework.
Trains agents for decision-making: shot selection, passing, positioning, and movement.
"""

from .training_config import RLConfig
from .game_environment import PSLGameEnvironment
from .dqn_agent import DQNAgent

__version__ = "0.1.0"
__all__ = ["RLConfig", "PSLGameEnvironment", "DQNAgent"]

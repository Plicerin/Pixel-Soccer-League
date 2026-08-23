"""
Extract weights from trained soccer_dqn_model.h5 into JSON format
for loading into PSL's TypeScript outfield player net.
"""

import json
import numpy as np

def extract_weights(model_path='rl/models/soccer_dqn_model.h5', output_path='rl/models/outfield_weights.json'):
    import h5py

    with h5py.File(model_path, 'r') as f:
        # Print structure to find weight keys
        def print_keys(name, obj):
            if isinstance(obj, h5py.Dataset):
                print(f"  {name}: {obj.shape}")
        print("H5 structure:")
        f.visititems(print_keys)

        # Collect all weight datasets
        datasets = {}
        def collect(name, obj):
            if isinstance(obj, h5py.Dataset) and len(obj.shape) > 0:
                datasets[name] = np.array(obj)
        f.visititems(collect)

    # Only model weights, not optimizer weights
    kernels = {k: v for k, v in datasets.items() if 'kernel' in k and k.startswith('model_weights')}
    biases = {k: v for k, v in datasets.items() if 'bias' in k and k.startswith('model_weights')}

    print(f"\nKernels found: {[(k, v.shape) for k,v in kernels.items()]}")
    print(f"Biases found: {[(k, v.shape) for k,v in biases.items()]}")

    # Sort by name to get layers in order
    sorted_kernels = sorted(kernels.items())
    sorted_biases = sorted(biases.items())

    (_, w1), (_, w2), (_, w3) = sorted_kernels
    (_, b1), (_, b2), (_, b3) = sorted_biases

    weights = {
        'w1': w1.T.flatten().tolist(),  # (128, 20) row-major for matmul
        'b1': b1.tolist(),
        'w2': w2.T.flatten().tolist(),  # (64, 128)
        'b2': b2.tolist(),
        'w3': w3.T.flatten().tolist(),  # (4, 64)
        'b3': b3.tolist(),
        'meta': {
            'state_size': 20,
            'hidden1': 128,
            'hidden2': 64,
            'action_size': 4,
            'actions': ['pass', 'shoot', 'dribble', 'move'],
        }
    }

    with open(output_path, 'w') as f:
        json.dump(weights, f)

    print(f"Weights extracted to {output_path}")
    print(f"  w1: {w1.shape} → {len(weights['w1'])} values")
    print(f"  w2: {w2.shape} → {len(weights['w2'])} values")
    print(f"  w3: {w3.shape} → {len(weights['w3'])} values")
    return weights

if __name__ == '__main__':
    extract_weights()

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Mock ENS registry for testing
/// @dev Simplified version for testing ENS integration
contract MockENS {
    mapping(bytes32 => address) private _owners;

    event NewOwner(bytes32 indexed node, address indexed owner);

    /// @notice Set the owner of a node
    function setOwner(bytes32 node, address ownerAddress) external {
        _owners[node] = ownerAddress;
        emit NewOwner(node, ownerAddress);
    }

    /// @notice Get the owner of a node
    function owner(bytes32 node) external view returns (address) {
        return _owners[node];
    }

    /// @notice Helper to compute namehash for testing
    /// @dev In production, use proper ENS namehash algorithm
    function namehash(string memory name) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(name));
    }
}

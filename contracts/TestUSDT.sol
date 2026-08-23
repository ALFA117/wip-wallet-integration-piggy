// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * USD₮ de prueba para la demo de WIP.
 *
 * ESTO NO ES EL USD₮ DE TETHER. Es un ERC-20 mínimo desplegado para el
 * hackathon, con los mismos 6 decimales que el real, porque el USD₮ de testnet
 * en Sepolia (0xd077A400968890Eacc75cdc901F0356c943e4fDb) existe pero no tiene
 * un faucet público al que pudiéramos llegar.
 *
 * Está documentado de forma prominente en el README y se dice en el video.
 * Lo que las bases prohíben es hacer pasar el token de otro emisor por USD₮ sin
 * avisar; un mock declarado está permitido.
 *
 * `mint` es abierto a propósito: cualquiera puede acuñarse fondos de prueba.
 * En un token real eso sería una vulnerabilidad; aquí es la función del faucet.
 */
contract TestUSDT {
    string public constant name = "Test Tether USD";
    string public constant symbol = "USDT";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance(uint256 available, uint256 required);
    error InsufficientAllowance(uint256 available, uint256 required);

    constructor(uint256 initialSupply) {
        _mint(msg.sender, initialSupply);
    }

    /// Faucet abierto: acuña fondos de prueba a cualquier dirección.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance(allowed, amount);
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance(balance, amount);
        unchecked {
            balanceOf[from] = balance - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) private {
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }
}

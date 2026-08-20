'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const FakeTimers = require('@sinonjs/fake-timers')
const Socks5ProxyAgent = require('../lib/dispatcher/socks5-proxy-agent')

class TestSocket extends EventEmitter {
  constructor ({ authenticate = false } = {}) {
    super()
    this.authenticate = authenticate
    this.destroyed = false
    this.writeCount = 0
  }

  write () {
    this.writeCount++

    if (this.authenticate && this.writeCount === 1) {
      this.emit('data', Buffer.from([0x05, 0x00]))
    }

    return true
  }

  destroy () {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    this.emit('close')
  }
}

function createAgent (socket) {
  return new Socks5ProxyAgent('socks5://proxy.example:1080', {
    connect (_opts, callback) {
      callback(null, socket)
    }
  })
}

test('Socks5ProxyAgent destroys the socket when authentication times out', async (t) => {
  const clock = FakeTimers.install()
  t.after(() => clock.uninstall())

  const socket = new TestSocket()
  const agent = createAgent(socket)
  const connecting = agent.createSocks5Connection('example.com', 80)
  const rejection = assert.rejects(connecting, /SOCKS5 authentication timeout/)

  await clock.tickAsync(0)
  await clock.tickAsync(5000)
  await rejection

  assert.equal(socket.destroyed, true)
  assert.equal(socket.writeCount, 1)
})

test('Socks5ProxyAgent destroys the socket when CONNECT times out', async (t) => {
  const clock = FakeTimers.install()
  t.after(() => clock.uninstall())

  const socket = new TestSocket({ authenticate: true })
  const agent = createAgent(socket)
  const connecting = agent.createSocks5Connection('example.com', 80)
  const rejection = assert.rejects(connecting, /SOCKS5 connection timeout/)

  await clock.tickAsync(0)
  await clock.tickAsync(5000)
  await rejection

  assert.equal(socket.destroyed, true)
  assert.equal(socket.writeCount, 2)
})

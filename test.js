fetch('http://localhost:3000/api/vms/101/vnc', {
  method: 'POST',
  headers: {
    // We don't have a valid session to hit this API without auth!
  }
})

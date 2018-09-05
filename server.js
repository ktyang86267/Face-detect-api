const express = require('express');
const bodyParse = require('body-parser');
const cors = require('cors');
const knex = require('knex');
const bcrypt = require('bcrypt-nodejs');
const clarifai = require('clarifai');

const clarifaiApp = new Clarifai.App({
  apiKey: '0f5d94ec2a7b4c7092919d4b135469fa'
});

const db = knex({
  client: 'pg',
  connection: {
    host : '127.0.0.1',
    user : 'aaronyang',
    password : '',
    database : 'face-detect'
  }
});

const app = express();
app.use(bodyParse.json());
app.use(cors());

//root
app.get('/', (req, res) => {
  res.send('It is working');
});

//main
app.get('/main', (req, res) => {
  console.log('In main page');
});

//signin
app.post('/signin', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json('incorrect form submission');
  }
  db.select('email', 'hash').from('login')
    .where('email', '=', email)
    .then(data => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return db.select('*').from('users')
          .where('email', '=', email)
          .then(user => {
            res.json(user[0]);
          })
          .catch(error => res.status(400).json('unable to get user'));
      } else {
        console.log('is error');
        res.status(400).json('wrong email or password');
      }
    })
    .catch(error => res.status(400).json('wrong email or password'))
});

//registor
app.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json('incorrect form submission');
  }
  const hashPassword = bcrypt.hashSync(password);
  db.transaction(trx => {
    trx.insert({
      hash: hashPassword,
      email: email
    })
      .into('login')
      .returning('email')
      .then(loginEmail => {
        return trx('users')
          .returning('*')
          .insert({
            email: loginEmail[0],
            name: name,
            joined: new Date()
          })
          .then(user => {
            res.json(user[0]);
          })
      })
      .then(trx.commit)
      .catch(trx.rollback);
  })
  .catch(err => res.status(400).json('unable to register'));
});

//profile
app.get('/profile/:id', (req, res) => {
  const { id } = req.params;
  db.select('*').from('users').where({ id })
    .then(user => {
      if(user.length){
        res.json(user[0]);
      } else {
        res.json(res.status(400).json('not found user profile'));
      }
    })
    .catch(error => res.status(400).json('err getting user'));
});

//image
app.put('/image', (req, res) => {
  const { id } = req.body;
  db('users').where('id', '=', id)
    .increment('entries', 1)
    .returning('entries')
    .then(entries => {
      res.json(entries[0]);
    })
    .catch(error => res.status(400).json('unable to get entry count'));
});

//imageURL
app.post('/imageurl', (req, res) => {
  clarifaiApp.models
    .predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
    .then(data => {
      res.json(data);
    })
    .catch(err => res.status(400).json('unable to work on API'));
});

app.listen(process.env.PORT || 3000, () => {
  console.log('App is running on port 3000!!');
});

/*
API design
/ --> res = this is working
/signin --> Post = succes/fail
/register --> Post = user
/profile/:userId --> Get = user
/image --> Put --> user
*/
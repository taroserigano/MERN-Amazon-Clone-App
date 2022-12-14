import React, { useEffect, useRef, useState } from 'react';
import socketIOClient from 'socket.io-client';
import { useSelector } from 'react-redux';
import MessageBox from '../components/MessageBox';

let allUsers = [];
let allMessages = [];
let allSelectedUser = {};
const ENDPOINT =
  window.location.host.indexOf('localhost') >= 0
    ? 'http://127.0.0.1:5000'
    : window.location.host;

export default function SupportScreen() {
  const [selectedUser, setSelectedUser] = useState({});
  const [socket, setSocket] = useState(null);
  const uiMessagesRef = useRef(null);
  const [messageBody, setMessageBody] = useState('');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const userSignin = useSelector((state) => state.userSignin);
  const { userInfo } = userSignin;

  useEffect(() => {
    // if chat window opened previously, (if there's ongoing chat) 
    if (uiMessagesRef.current) {
      // this will scroll down all the way to the bottom of existing chat 
      uiMessagesRef.current.scrollBy({
        top: uiMessagesRef.current.clientHeight,
        left: 0,
        behavior: 'smooth',
      });
    }
    // if no socket exists
    if (!socket) {
      // create one and set it 
      const sk = socketIOClient(ENDPOINT);
      setSocket(sk);
      // then log in with user info 
      sk.emit('onLogin', {
        _id: userInfo._id,
        name: userInfo.name,
        isAdmin: userInfo.isAdmin,
      });
      
      // if message was sent from somewhere, 
      sk.on('message', (data) => {
        // allSelectedUser - currently ongoing chat Users 
        // if currently ongoing, add this msg to the existing msg list 
        if (allSelectedUser._id === data._id) {
          allMessages = [...allMessages, data];
        } else {
          // else, find the recipient from allUsers and send it with status: unread 
          const existUser = allUsers.find((user) => user._id === data._id);
          if (existUser) {
            allUsers = allUsers.map((user) =>
              user._id === existUser._id ? { ...user, unread: true } : user
            );
            setUsers(allUsers);
          }
        }
        setMessages(allMessages);
      });
      
      
      sk.on('updateUser', (updatedUser) => {
        // check if this user exist, 
        const existUser = allUsers.find((user) => user._id === updatedUser._id);
        // if exist, simply update it 
        if (existUser) {
          allUsers = allUsers.map((user) =>
            user._id === existUser._id ? updatedUser : user
          );
          setUsers(allUsers);
          // else, Add this user 
        } else {
          allUsers = [...allUsers, updatedUser];
          setUsers(allUsers);
        }
      });
      
      // list all existing users
      sk.on('listUsers', (updatedUsers) => {
        allUsers = updatedUsers;
        setUsers(allUsers);
      }); 
      
      sk.on('selectUser', (user) => {
        allMessages = user.messages;
        setMessages(allMessages);
      });
    }
  }, [messages, socket, users, userInfo]);

  const selectUser = (user) => {
    // essentially, select just ONE user like this 
    allSelectedUser = user;
    // set the one user 
    setSelectedUser(allSelectedUser);
    const existUser = allUsers.find((x) => x._id === user._id);
    // all this work below, just to set to: unread - false 
    if (existUser) {
      allUsers = allUsers.map((x) =>
        x._id === existUser._id ? { ...x, unread: false } : x
      );
      setUsers(allUsers);
    }
    socket.emit('onUserSelected', user);
  };
  
  const submitHandler = (e) => {
    e.preventDefault();
    // if empty 
    if (!messageBody.trim()) {
      alert('Error. Please type message.');
    } else {
      // add message 
      allMessages = [
        ...allMessages,
        { body: messageBody, name: userInfo.name },
      ];
      setMessages(allMessages);
      setMessageBody('');
      // send out this message with onMessage signal 
      setTimeout(() => {
        socket.emit('onMessage', {
          body: messageBody,
          name: userInfo.name,
          isAdmin: userInfo.isAdmin,
          _id: selectedUser._id,
        });
      }, 1000);
    }
  };

  return (
    <div className="row top full-container">
      <div className="col-1 support-users">
        {users.filter((x) => x._id !== userInfo._id).length === 0 && (
          <MessageBox>No Online User Found</MessageBox>
        )}
        <ul>
          {users
            .filter((x) => x._id !== userInfo._id)
            .map((user) => (
              <li
                key={user._id}
                className={user._id === selectedUser._id ? '  selected' : '  '}
              >
                <button
                  className="block"
                  type="button"
                  onClick={() => selectUser(user)}
                >
                  {user.name}
                </button>
                <span
                  className={
                    user.unread ? 'unread' : user.online ? 'online' : 'offline'
                  }
                />
              </li>
            ))}
        </ul>
      </div>
      <div className="col-3 support-messages">
        {!selectedUser._id ? (
          <MessageBox>Select a user to start chat</MessageBox>
        ) : (
          <div>
            <div className="row">
              <strong>Chat with {selectedUser.name} </strong>
            </div>
            <ul ref={uiMessagesRef}>
              {messages.length === 0 && <li>No message.</li>}
              {messages.map((msg, index) => (
                <li key={index}>
                  <strong>{`${msg.name}: `}</strong> {msg.body}
                </li>
              ))}
            </ul>
            <div>
              <form onSubmit={submitHandler} className="row">
                <input
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  type="text"
                  placeholder="type message"
                />
                <button type="submit">Send</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

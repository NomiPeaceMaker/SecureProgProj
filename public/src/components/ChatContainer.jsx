import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import Logout from "./Logout";
import axios from "axios";
import { getAllMessagesRoute, sendMessageRoute } from "../utils/APIRoutes";
import { v4 as uuidv4 } from "uuid";
import { JSEncrypt } from "jsencrypt";
import { AES, enc, pad, mode, MD5 } from "crypto-js";

export default function ChatContainer({ currentChat, currentUser, socket }) {
  const [messages, setMessages] = useState([]);
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const scrollRef = useRef();

  // Function to decrypt AES 128 CBC hex string
  const decryptAES = (encryptedData, secretKey, iv) => {
    // Assuming encryptedData contains the encrypted key in hexadecimal format
    // Convert the secret key and IV to WordArray
    const secretKeyWordArray = enc.Utf8.parse(secretKey);
    const ivWordArray = enc.Hex.parse(iv);

    // Convert the ciphertext hex string to WordArray
    const encryptedDataWordArray = enc.Hex.parse(encryptedData);

    // Decrypt the ciphertext using AES 128 CBC mode
    const decryptedWordArray = AES.decrypt(
      { ciphertext: encryptedDataWordArray },
      secretKeyWordArray,
      { iv: ivWordArray, mode: mode.CBC, padding: pad.Pkcs7 }
    );

    // Convert the decrypted WordArray to a UTF-8 string (original Securitykey)
    let decryptedSecuritykey = decryptedWordArray.toString(enc.Utf8);
    // The decrypted key has some corrupt data in the beginning so fixing that line
    decryptedSecuritykey =
      "-----BEGIN RSA PRIVATE KEY-----" +
      decryptedSecuritykey.substring("-----BEGIN RSA PRIVATE KEY-----".length);
    return decryptedSecuritykey;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (currentChat) {
        const response = await axios.post(getAllMessagesRoute, {
          from: currentUser._id,
          to: currentChat._id,
        });

        // Decrypt private key with the password
        const cipherTextHex = currentUser.encryptedPrivateKey;
        let secretKey =
          currentUser.password + MD5(currentUser.password).toString();
        secretKey = secretKey.slice(0, 16);
        const iv = "0000000000000000";

        const privateKey = decryptAES(cipherTextHex, secretKey, iv);

        var decrypt = new JSEncrypt();
        decrypt.setPrivateKey(privateKey);
        // let response.data = response.data;

        for (let i = 0; i < response.data.length; i++) {
          if (response.data[i].fromSelf == true) {
            // decrypt assymetric key with privte key
            var symmetricKey = decrypt.decrypt(response.data[i].keys.sender);
            // now use this symmetric key to decrypt the message
            var bytes = AES.decrypt(response.data[i].message, symmetricKey);
            response.data[i].message = JSON.parse(bytes.toString(enc.Utf8));
          } else {
            var symmetricKey = decrypt.decrypt(response.data[i].keys.receiver);
            var bytes = AES.decrypt(response.data[i].message, symmetricKey);
            response.data[i].message = JSON.parse(bytes.toString(enc.Utf8));
          }
        }
        setMessages(response.data);
      }
    };
    fetchData();
  }, [currentChat, arrivalMessage]);

  const handleSendMsg = async (msg) => {
    // Generating random string:
    var randomstring = require("randomstring");
    var AES = require("crypto-js/aes");
    var assymetricKey = randomstring.generate();

    // Encrypting message with assymetric key
    var ciphertext = AES.encrypt(JSON.stringify(msg), assymetricKey).toString();
    // https://www.code-sample.com/2019/12/react-encryption-decryption-data-text.html

    // Encrypting assymetric key with both public keys
    var encryptReceiver = new JSEncrypt();
    var encryptSender = new JSEncrypt();
    var publicKeyReceiver = currentChat.publicKey;
    var publicKeySender = currentUser.publicKey;

    // Assign our encryptor to utilize the public key.
    encryptReceiver.setPublicKey(publicKeyReceiver);
    encryptSender.setPublicKey(publicKeySender);
    // Perform our encryption based on our public key - only private key can read it!
    var encryptedKeyReceiver = encryptReceiver.encrypt(assymetricKey);
    var encryptedKeySender = encryptSender.encrypt(assymetricKey);

    await axios.post(sendMessageRoute, {
      from: currentUser._id,
      to: currentChat._id,
      message: ciphertext,
      keys: {
        sender: encryptedKeySender,
        receiver: encryptedKeyReceiver,
      },
    });
    socket.current.emit("send-msg", {
      to: currentChat._id,
      from: currentUser._id,
      message: ciphertext,
      keys: {
        sender: encryptedKeySender,
        receiver: encryptedKeyReceiver,
      },
    });

    const msgs = [...messages];
    msgs.push({
      fromSelf: true,
      message: msg,
    });
    setMessages(msgs);
  };

  useEffect(() => {
    if (socket.current) {
      socket.current.on("msg-recieved", (msg) => {
        setArrivalMessage({
          fromSelf: false,
          message: msg,
        });
      });
    }
  }, []);

  useEffect(() => {
    arrivalMessage && setMessages((prev) => [...prev, arrivalMessage]);
  }, [arrivalMessage]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {currentChat && (
        <Container>
          <div className="chat-header">
            <div className="user-details">
              <div className="avatar">
                <img
                  src={`data:image/svg+xml;base64,${currentChat.avatarImage}`}
                  alt="avatar"
                />
              </div>
              <div className="username">
                <h3>{currentChat.username}</h3>
              </div>
            </div>
            <Logout />
          </div>
          <div className="chat-messages">
            {messages.map((message) => {
              return (
                <div ref={scrollRef} key={uuidv4()}>
                  <div
                    className={`message ${
                      message.fromSelf ? "sended" : "recieved"
                    }`}
                  >
                    <div className="content ">
                      <p>{message.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <ChatInput handleSendMsg={handleSendMsg} />
        </Container>
      )}
    </>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  gap: 0.1rem;
  overflow: hidden;
  @media screen and (min-width: 720px) and (max-width: 1080px) {
    grid-template-rows: 15% 70% 15%;
  }
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
    .user-details {
      display: flex;
      align-items: center;
      gap: 1rem;
      .avatar {
        img {
          height: 3rem;
        }
      }
      .username {
        h3 {
          color: white;
          text-transform: capitalize;
        }
      }
    }
  }
  .chat-messages {
    padding: 1rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }
    .message {
      display: flex;
      align-items: center;
      .content {
        max-width: 40%;
        overflow-wrap: break-word;
        padding: 1rem;
        font-size: 1.1rem;
        border-radius: 1rem;
        color: #d1d1d1;
        @media screen and (min-width: 720px) and (max-width: 1080px) {
          max-width: 70%;
        }
      }
    }
    .sended {
      justify-content: flex-end;
      .content {
        background-color: #4f04ff21;
      }
    }
    .recieved {
      justify-content: flex-start;
      .content {
        background-color: #9900ff20;
      }
    }
  }
`;

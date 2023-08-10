import React from 'react';
import styled from 'styled-components';
import Robot from '../assets/robot.gif';
import Logout from './Logout';

export default function Welcome({ currentUser }) {
  return (
    <Container>
      <TopRight>
        <Logout />
      </TopRight>
      <Content>
        <img src={Robot} alt="welcome" />
        <h1>
          Welcome, <span>{currentUser.username}!</span>
        </h1>
        <h3>Please select a chat to start Messaging.</h3>
      </Content>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
`;

const TopRight = styled.div`
  align-self: flex-end;
  margin: 1rem;
`;

const Content = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  img {
    height: 20rem;
  }
  span {
    color: #4e00ff;
    text-transform: capitalize;
  }
`;

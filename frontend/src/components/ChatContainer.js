import React, { useRef, createRef, useEffect, useState } from "react";
import "../css/playView.css";
import io from "socket.io-client";
import Comment from "./Comment";
import Input from "./Input";
import Axios from "axios";

import arrow from "../imgs/arrow.png";
import useInterval from "@use-it/interval";

import TmpCookie from "react-cookies";
const COMMENT_BASE_URL = "http://27.96.130.172/api/comment/";
const COMMENT_SLICE_LENGTH = 999999;

let socket;

// 정해진 분량의 댓글을 호출
const _getComments = async (videoId, startTime = 0, until = COMMENT_SLICE_LENGTH) => {
  const URL = `${COMMENT_BASE_URL}comments?video=${videoId}&timeline=${startTime}&offset=${startTime + until}`;
  try {
    const data = await Axios.get(URL).then((res) => res.data);
    if (data.response === "error") throw data;
    return data.data;
  } catch (error) {
    const errComment = {
      id: "관리자",
      text: `현재 댓글 서버가 원활하지 않습니다. ${JSON.stringify(error)}`,
      createdAt: new Date().toISOString(),
      timeline: 0.0,
      video: videoId,
    };
    return [errComment];
  }
};

//댓글 REST API에 저장
const _createComments = async (videoId, message, timeline) => {
  console.log("in createComments");
  const URL = `${COMMENT_BASE_URL}comment`;
  const BODY = {
    cookie: TmpCookie.load("id"),
    video: videoId,
    message,
    timeline,
  };
  try {
    console.log(BODY);
    const data = await Axios.post(URL, BODY).then((res) => {
      console.log(res);
      return res.data;
    });
    console.log("data: ", data);
    if (data.response === "error") throw data;
    return data.data;
  } catch (error) {
    console.log(error);
    const errComment = {
      id: "관리자",
      text: `현재 댓글 서버가 원활하지 않습니다. ${JSON.stringify(error)}`,
      createdAt: new Date().toISOString(),
      timeline: 0.0,
      video: videoId,
    };
    return [errComment];
  }
};

const ChatContainer = ({ _name, _videoId, _timeline, _lastPoint }) => {
  console.log(_lastPoint);
  const [name, setName] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [messages, setMessages] = useState([]);
  const $input = createRef();
  const $commentContainer = useRef();

  // -------------------------
  //  socket 연결/관리 & DB로부터 댓글 받아오기
  // -------------------------
  const ENDPOINT = "ws://49.50.173.151:3000";
  // 소켓은 최초 1회만 연결
  useEffect(() => {
    socket = io(ENDPOINT);
    socket.once("connect", () => console.log(`INFO (ChatContainer.js) : 소켓 : 연결완료`));
    socket.emit("join", "video1");

    // 처음(0초) 한번만 DB로부터 댓글 받아오기
    _getComments(_videoId, _timeline, COMMENT_SLICE_LENGTH).then((comments) => {
      comments.sort((a, b) => (a.timeline < b.timeline ? -1 : a.timeline === b.timeline ? 0 : 1)); // 시간 순 정렬
      setMessages(comments);
    });
  }, []);

  // -------------------------
  //  socket으로부터 댓글 받기
  // -------------------------
  // 이후 소켓 한 번 호출 때마다 호출 열었다 닫았다 함. 이렇게 하는 이유는 state(messages)를 추적하지 못해서.
  useEffect(() => {
    socket.on("newMessage", (newMessage) => {
      console.log(`INFO (ChatContainer.js) : 새 메시지 수신 : ${JSON.stringify(newMessage, null, 2)}`);
      console.log("newmsg: ", newMessage);
      const convertedMsg = {
        nickname: newMessage.id,
        message: newMessage.text,
        timeline: newMessage.timeline,
      };
      const nextMessages = [...messages, convertedMsg];

      nextMessages.sort((a, b) => (a.timeline < b.timeline ? -1 : a.timeline === b.timeline ? 0 : 1)); // 시간 순 정렬
      console.log(`INFO (ChatContainer.js) : 현재 보관중인 메시지 목록 : ${JSON.stringify(nextMessages, null, 2)}`);
      setMessages(nextMessages);
    });
    // 메시지 새로 받을 때마다 스크롤이 맨밑이면 스크롤 최하단으로 이동
    const currentY = $commentContainer.current.scrollHeight - $commentContainer.current.scrollTop;
    const scrollViewHeight = $commentContainer.current.clientHeight + 100;
    if (currentY === scrollViewHeight) {
      $commentContainer.current.scrollTo(0, $commentContainer.current.scrollHeight);
    } else {
      console.log("새메시지 도착");
    }

    return () => socket.off("newMessage");
  }, [messages]);

  const toBottom = () => {
    $commentContainer.current.scrollTo(0, $commentContainer.current.scrollHeight);
  };

  // -------------------------
  //  socket으로 댓글 보내기
  // -------------------------
  const sendMessage = (message) => {
    // 공백제거 코드
    const blank_pattern = /^\s+|\s+$/g;
    if (!message || message.length === 0 || message.replace(blank_pattern, "") === "") return;
    console.log(`INFO (ChatContainer.js) : 새 메시지 발송 : ${message}`);
    _createComments(_videoId, message, Math.floor(_timeline * 100) / 100);
    socket.emit(
      "newComment",
      {
        id: TmpCookie.load("nickname"),
        message,
        createdAt: new Date(),
        timeline: Math.floor(_timeline * 100) / 100,
        video: "video1",
      }
    );
    $commentContainer.current.scrollTo(0, $commentContainer.current.scrollHeight);
    $input.current.focus();
  };

  const filteredMessages = messages
    .filter((message) => _lastPoint <= message.timeline && message.timeline <= _timeline)
    .map((message, index) => <Comment key={index} message={message} />);

  return (
    <div className="ChatContainer">
      <div ref={$commentContainer} className="commentContainer">
        <div className="chatHeader"> 타임라인별 댓글 </div> {filteredMessages}{" "}
      </div>{" "}
      <Input ref={$input} sendMessage={sendMessage} />{" "}
      <div className="floatBottom" onClick={toBottom}>
        <img className="arrowImg" src={arrow} />
      </div>
    </div>
  );
};

export default ChatContainer;

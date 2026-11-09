import { cn } from "@/lib/utils";
import { useState } from "react";
import "./loader-3.css";

export const Component = ({ className = "" }) => {
  const [count, setCount] = useState(0);

  return (
    <div className={cn("loader", className)}>
      <div className="box box0">
        <div></div>
      </div>
      <div className="box box1">
        <div></div>
      </div>
      <div className="box box2">
        <div></div>
      </div>
      <div className="box box3">
        <div></div>
      </div>
      <div className="box box4">
        <div></div>
      </div>
      <div className="box box5">
        <div></div>
      </div>
      <div className="box box6">
        <div></div>
      </div>
      <div className="box box7">
        <div></div>
      </div>
      <div className="ground">
        <div></div>
      </div>
    </div>
  );
};

export default Component;

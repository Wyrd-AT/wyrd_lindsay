// src/hooks/useEquipamentos.js
import { useState } from "react";

export default function useEquipamentos(max = 16) {
  const [list, setList] = useState([""]);
  const add = () => list.length < max && setList([...list, ""]);
  const remove = (i) => setList(list.filter((_, idx) => idx !== i));
  const update = (i, v) => {
    const next = [...list];
    next[i] = v;
    setList(next);
  };
  return { list, add, remove, update };
}

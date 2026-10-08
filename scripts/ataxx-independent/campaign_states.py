"""Emit independent values for every reachable in-horizon campaign decision state."""
import json
from campaign import read_levels,position,evaluator,root_value,small_key
from oracle import actions,play,result
from fixtures import external


def emit():
    output=[]
    for lesson in read_levels():
        initial=position(lesson);g=lesson['goal'];seen=set()
        if g['kind']!='move':value,horizon,_=evaluator(lesson)
        def visit(p,history):
            identity=(p,len(history))
            if identity in seen:return
            seen.add(identity)
            if g['kind']=='move':
                stage='playing' if not history else 'success' if root_value(lesson,initial,history[0])>0 else 'retry'
            elif result(p):stage='success' if result(p)=='x' else 'retry'
            elif len(history)==horizon:stage='success' if g['kind']=='hold' and p.x.bit_count()>=g['target'] else 'retry'
            else:stage='playing'
            vals={}
            if stage=='playing':
                for m in actions(p):
                    vals[small_key(m,lesson['size'])]=root_value(lesson,p,m) if g['kind']=='move' else value(play(p,m),horizon-len(history)-1)
                expected=(max if p.turn=='x' else min)(vals.values())
            else:expected=1 if stage=='success' else -1
            output.append({'id':lesson['id'],'position':external(p,lesson['size']),'history':[small_key(m,lesson['size']) for m in history],'stage':stage,'value':expected,'choices':vals})
            if stage=='playing':
                for m in actions(p):visit(play(p,m),[*history,m])
        visit(initial,[])
    print(json.dumps(output,separators=(',',':')))

if __name__=='__main__':emit()

import logging
import time
from threading import Semaphore

logger = logging.getLogger(__name__)

class Bar():

	waiting_list = []
	ready_list = []
	glass_area = ['X','X','X']
	bar_area = ['O','O','O']
	displaying_list=[]

	no_glass_position = False

	ready = True
	priority = False
	action = False

	semAction = Semaphore(1)
	semReady = Semaphore(1)
	semPrio = Semaphore(1)

	@staticmethod
	def reset(hard=False):
		Bar.glass_area = ['X','X','X']
		Bar.bar_area = ['O','O','O']
		ready = True
		priority = False
		action = False
		if hard:
			Bar.waiting_list = []
			Bar.displaying_list=[]

	@staticmethod
	def setNoGlassPosition(value):
		Bar.no_glass_position = value

	@staticmethod
	def getNoGlassPosition():
		return Bar.no_glass_position

	@staticmethod
	def resetGlass(pos):
		Bar.glass_area[pos] = 'X'

	@staticmethod
	def getPrio():
		Bar.semPrio.acquire()
		p = Bar.priority
		Bar.semPrio.release()
		return p

	@staticmethod
	def getSlot(num):
		logger.debug(Bar.bar_area)
		if not num in Bar.bar_area or not num in Bar.ready_list:
			return -1
		return Bar.bar_area.index(num)

	@staticmethod
	def freeSlot(num):
		if not num in Bar.bar_area:
			raise Exception("" + str(num) + " not in bar_area")
		i = Bar.bar_area.index(num)
		Bar.bar_area[i] = 'O'

	@staticmethod
	def setReady(num=None):
		no_glass_position = False
		Bar.semReady.acquire()
		Bar.ready = True
		Bar.semReady.release()
		if num:
			Bar.ready_list.append(num)

	@staticmethod
	def freePrior():
		Bar.semPrio.acquire()
		Bar.priority = False
		Bar.semPrio.release()

	@staticmethod
	def getReady():
		r = False
		Bar.semReady.acquire()

		if Bar.ready:
			Bar.ready = False
			r = True
		Bar.semReady.release()
		return r

	@staticmethod
	def receiveOrder(num):
		logger.debug("Num received " + str(num))
		Bar.waiting_list.append(num)

	@staticmethod
	def checkNextOrder():
		if len(Bar.waiting_list) == 0:
			raise Exception("No order to prepare.")

		available_slots = True
		if (not 'X' in Bar.glass_area) or (not 'O' in Bar.bar_area):
			available_slots = False

		return Bar.waiting_list[0], available_slots

	@staticmethod
	def prepareNextOrder():
		if len(Bar.waiting_list) == 0:
			raise Exception("No order to prepare.")

		if (not 'X' in Bar.glass_area) or (not 'O' in Bar.bar_area):
			raise Exception("No available slot")

		startpos = Bar.glass_area.index('X')
		Bar.glass_area[startpos] = 'O'
		endpos = Bar.bar_area.index('O')
		Bar.bar_area[endpos] = Bar.waiting_list.pop(0)

		return startpos, endpos

	@staticmethod
	def startAction(prior=False):
		a = False
		Bar.semAction.acquire()
		if not Bar.getPrio():

			if prior:
				Bar.semPrio.acquire()
				Bar.priority = True
				Bar.semPrio.release()
				b = Bar.action

				while b:
					Bar.semAction.release()
					time.sleep(2)
					Bar.semAction.acquire()
					b = Bar.action

			if not Bar.action:
				Bar.action = True
				a = True


		Bar.semAction.release()
		return a

	@staticmethod
	def stopAction():
		Bar.semAction.acquire()
		Bar.action = False
		Bar.semAction.release()

	@staticmethod
	def majDisplayingList(num,drink,end):
		if end == 0:
			Bar.displaying_list.append({'num':num,'drink':"/img/" + drink + ".png",'pos':end,'state':"/img/waiting.png"})
		else:
			for order in Bar.displaying_list:
				if order['num'] == num :
					order['pos']=end
					if order['state'] == "/img/preparing.png":
						order['state']="/img/ready.png"
					elif order['state'] == "/img/waiting.png":
						order['state']="/img/preparing.png"
					else:
						Bar.displaying_list.remove(order)

		logger.debug(Bar.displaying_list)
		return Bar.displaying_list
